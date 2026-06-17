import { pbAdmin } from "@/lib/pb";
import { MercadoLivreApiService } from "./mercado-livre-api.service";

type SyncProgressCallback = (progress: number) => Promise<void> | void;

export interface SyncReport {
  success: boolean;
  accountId: string;
  nickname: string;
  errors: string[];
  listingsCount: number;
  ordersCount: number;
  questionsCount: number;
  reputationLevel?: string;
  promotionsCount: number;
  campaignsCount: number;
}

export class MercadoLivreSyncService {
  private static async reportProgress(onProgress: SyncProgressCallback | undefined, progress: number) {
    if (!onProgress) return;
    await onProgress(progress);
  }

  /**
   * Sincroniza uma conta específica do Mercado Livre com o banco de dados local
   */
  static async syncAccount(
    accountId: string,
    organizationId: string,
    userId: string,
    ipAddress?: string,
    onProgress?: SyncProgressCallback
  ): Promise<SyncReport> {
    const report: SyncReport = {
      success: false,
      accountId,
      nickname: "",
      errors: [],
      listingsCount: 0,
      ordersCount: 0,
      questionsCount: 0,
      promotionsCount: 0,
      campaignsCount: 0,
    };

    // 1. Carrega a conta e o token do banco
    let account;
    try {
      account = await pbAdmin.collection("mercado_livre_accounts").getFirstListItem(`id="${accountId}" && organization="${organizationId}" && isActive=true`);
    } catch (e) {
      const err = "Conta do Mercado Livre não encontrada ou acesso negado.";
      report.errors.push(err);
      await this.logAudit(organizationId, userId, accountId, "SYNC_FAILED", err, ipAddress);
      return report;
    }

    report.nickname = account.nickname || "";

    let token;
    try {
      token = await pbAdmin.collection("oauth_tokens").getFirstListItem(`account="${account.id}"`);
    } catch (e) {
      const err = `Nenhum token de autorização encontrado para a conta ${account.nickname}.`;
      report.errors.push(err);
      await this.logAudit(organizationId, userId, accountId, "SYNC_FAILED", err, ipAddress);
      return report;
    }

    await this.reportProgress(onProgress, 5);

    let accessToken = token.accessToken;
    let refreshToken = token.refreshToken;
    let expiresAt = new Date(token.expiresAt);

    // 2. Renova o token se expirado ou prestes a expirar (menos de 5 minutos de validade)
    const now = new Date();
    const isCloseToExpire = expiresAt.getTime() - now.getTime() < 5 * 60 * 1000;

    if (isCloseToExpire || account.status === "EXPIRED") {
      try {
        if (accessToken.includes("mock-token") || refreshToken.includes("mock-token")) {
          const newExpiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000); // +6 horas
          await pbAdmin.collection("oauth_tokens").update(token.id, { expiresAt: newExpiresAt.toISOString() });
          expiresAt = newExpiresAt;
          await this.logAudit(
            organizationId,
            userId,
            accountId,
            "REFRESH_TOKEN",
            "Token OAuth simulado (mock) renovado com sucesso.",
            ipAddress
          );
          await this.reportProgress(onProgress, 10);
        } else {
          // Renovação real
          const refreshRes = await MercadoLivreApiService.refreshToken(refreshToken);
          const newExpiresAt = new Date(Date.now() + refreshRes.expires_in * 1000);

          await pbAdmin.collection("oauth_tokens").update(token.id, {
            accessToken: refreshRes.access_token,
            refreshToken: refreshRes.refresh_token,
            expiresAt: newExpiresAt.toISOString(),
          });

          accessToken = refreshRes.access_token;
          refreshToken = refreshRes.refresh_token;
          expiresAt = newExpiresAt;

          await pbAdmin.collection("mercado_livre_accounts").update(account.id, { status: "CONNECTED" });

          await this.logAudit(
            organizationId,
            userId,
            accountId,
            "REFRESH_TOKEN",
            "Token OAuth real renovado com sucesso via API oficial.",
            ipAddress
          );
          await this.reportProgress(onProgress, 10);
        }
      } catch (err: any) {
        const errMsg = `Falha crítica ao renovar token OAuth: ${err.message || err}`;
        report.errors.push(errMsg);
        
        await pbAdmin.collection("mercado_livre_accounts").update(account.id, { status: "EXPIRED" });

        await this.logAudit(organizationId, userId, accountId, "SYNC_FAILED", errMsg, ipAddress);
        return report;
      }
    }

    const isMock = accessToken.includes("mock-token");

    // 3. Executa as sincronias de entidades individuais
    
    // --- 3.1 Detalhes Cadastrais & Reputação ---
    try {
      if (!isMock) {
        const details = await MercadoLivreApiService.fetchAccountDetails(accessToken);
        
        // Atualiza e-mail e status se alterados
        await pbAdmin.collection("mercado_livre_accounts").update(account.id, {
          email: details.email || account.email,
          status: "CONNECTED",
        });

        // Reputação
        if (details.seller_reputation) {
          const rep = details.seller_reputation;
          const repData = {
            organization: organizationId,
            account: accountId,
            levelId: rep.level_id || "unknown",
            powerSellerStatus: rep.power_seller_status || "",
            transactionsTotal: (rep.transactions as any)?.total || 0,
            transactionsCompleted: rep.transactions?.completed || 0,
            transactionsCanceled: (rep.transactions as any)?.canceled || 0,
            metricsSalesCompleted: (rep.metrics as any)?.sales?.completed || 0,
          };

          let repRecord;
          try {
            repRecord = await pbAdmin.collection("seller_reputations").getFirstListItem(`account="${accountId}"`);
          } catch(e) {}

          if (repRecord) {
            await pbAdmin.collection("seller_reputations").update(repRecord.id, repData);
            report.reputationLevel = repData.levelId;
          } else {
            const created = await pbAdmin.collection("seller_reputations").create(repData);
            report.reputationLevel = created.levelId;
          }
        }
      }
    } catch (err: any) {
      report.errors.push(`Erro ao sincronizar reputação: ${err.message || err}`);
    }

    await this.reportProgress(onProgress, 25);

    // --- 3.2 Anúncios (Listings) ---
    try {
      if (!isMock) {
        const listings = await MercadoLivreApiService.fetchListings(account.meliUserId, accessToken);
        
        for (const item of listings) {
          const listingData = {
            organization: organizationId,
            account: accountId,
            mlItemId: item.id,
            title: item.title || "",
            price: item.price || 0,
            availableQuantity: item.available_quantity || 0,
            soldQuantity: item.sold_quantity || 0,
            condition: (item as any).condition || "",
            permalink: item.permalink || "",
            thumbnail: item.thumbnail || "",
            status: item.status || "active",
            catalogProductId: (item as any).catalog_product_id || "",
            health: (item as any).health || 0,
            visits: 0
          };

          try {
            const existing = await pbAdmin.collection("listings").getFirstListItem(`account="${accountId}" && mlItemId="${item.id}"`);
            await pbAdmin.collection("listings").update(existing.id, listingData);
          } catch (e) {
            await pbAdmin.collection("listings").create(listingData);
          }
          report.listingsCount++;
        }
      }
    } catch (err: any) {
      report.errors.push(`Erro ao sincronizar anúncios: ${err.message || err}`);
    }

    await this.reportProgress(onProgress, 45);

    // --- 3.3 Vendas (Orders) ---
    try {
      if (!isMock) {
        const orders = await MercadoLivreApiService.fetchOrders(account.meliUserId, accessToken);

        for (const order of orders) {
          const orderData = {
            organization: organizationId,
            account: accountId,
            mlOrderId: order.id.toString(),
            status: order.status,
            dateCreated: new Date(order.date_created).toISOString(),
            totalAmount: order.total_amount,
            currencyId: (order as any).currency_id || "BRL",
            buyerNickname: order.buyer?.nickname || "Desconhecido",
            itemCount: order.order_items ? order.order_items.length : 0
          };

          try {
            const existing = await pbAdmin.collection("orders").getFirstListItem(`account="${accountId}" && mlOrderId="${order.id.toString()}"`);
            await pbAdmin.collection("orders").update(existing.id, orderData);
          } catch (e) {
            await pbAdmin.collection("orders").create(orderData);
          }

          report.ordersCount++;
        }
      }
    } catch (err: any) {
      report.errors.push(`Erro ao sincronizar vendas: ${err.message || err}`);
    }

    await this.reportProgress(onProgress, 65);

    // --- 3.4 Perguntas (Questions) ---
    try {
      if (!isMock) {
        const questions = await MercadoLivreApiService.fetchQuestions(account.meliUserId, accessToken);

        for (const question of questions) {
          const questionData = {
            organization: organizationId,
            account: accountId,
            mlQuestionId: question.id.toString(),
            itemId: question.item_id,
            status: question.status,
            text: question.text,
            answer: question.answer ? question.answer.text : "",
            dateCreated: new Date(question.date_created).toISOString()
          };

          try {
            const existing = await pbAdmin.collection("questions").getFirstListItem(`account="${accountId}" && mlQuestionId="${question.id.toString()}"`);
            await pbAdmin.collection("questions").update(existing.id, questionData);
          } catch (e) {
            await pbAdmin.collection("questions").create(questionData);
          }
          report.questionsCount++;
        }
      }
    } catch (err: any) {
      report.errors.push(`Erro ao sincronizar perguntas: ${err.message || err}`);
    }

    await this.reportProgress(onProgress, 80);

    // --- 3.5 Promoções (Promotions) ---
    try {
      if (!isMock) {
        const promos = await MercadoLivreApiService.fetchPromotions(account.meliUserId, accessToken);

        for (const promo of promos) {
          const promoData = {
            organization: organizationId,
            mlPromotionId: promo.id,
            name: promo.name || "Promoção sem nome",
            type: promo.type || "deal",
            status: promo.status || "active",
            startDate: new Date(promo.start_date).toISOString(),
            endDate: new Date(promo.deadline_date).toISOString()
          };

          try {
            const existing = await pbAdmin.collection("promotions").getFirstListItem(`organization="${organizationId}" && mlPromotionId="${promo.id}"`);
            await pbAdmin.collection("promotions").update(existing.id, promoData);
          } catch (e) {
            await pbAdmin.collection("promotions").create(promoData);
          }
          report.promotionsCount++;
        }
      }
    } catch (err: any) {
      report.errors.push(`Erro ao sincronizar promoções: ${err.message || err}`);
    }

    await this.reportProgress(onProgress, 90);

    // --- 3.6 Campanhas Ads (Advertising Campaigns) ---
    try {
      if (!isMock) {
        const campaigns = await MercadoLivreApiService.fetchCampaigns(account.meliUserId, accessToken);

        for (const camp of campaigns) {
          const campData = {
            organization: organizationId,
            mlCampaignId: camp.id.toString(),
            name: camp.name || "Campanha Product Ads",
            status: camp.status || "active",
            budget: camp.daily_budget || 0,
            budgetType: "daily",
          };

          try {
            const existing = await pbAdmin.collection("advertising_campaigns").getFirstListItem(`organization="${organizationId}" && mlCampaignId="${camp.id.toString()}"`);
            await pbAdmin.collection("advertising_campaigns").update(existing.id, campData);
          } catch (e) {
            await pbAdmin.collection("advertising_campaigns").create(campData);
          }
          report.campaignsCount++;
        }
      }
    } catch (err: any) {
      report.errors.push(`Erro ao sincronizar campanhas Ads: ${err.message || err}`);
    }

    await this.reportProgress(onProgress, 95);

    // 4. Consolida e registra auditoria final
    report.success = report.errors.length === 0;
    await this.reportProgress(onProgress, 100);

    const detailsSummary = `Sincronização concluída para a conta '${
      account.nickname
    }'. Resumo: ${report.listingsCount} anúncios, ${report.ordersCount} vendas, ${
      report.questionsCount} perguntas, ${report.promotionsCount} promoções, ${
      report.campaignsCount} campanhas Ads. Erros isolados: ${report.errors.length}`;

    await this.logAudit(
      organizationId,
      userId,
      accountId,
      report.success ? "SYNC_SUCCESS" : "SYNC_PARTIAL",
      detailsSummary,
      ipAddress
    );

    return report;
  }

  /**
   * Helper estático para gravar trilha de auditoria operacional
   */
  private static async logAudit(
    organizationId: string,
    userId: string,
    meliAccountId: string | null,
    action: string,
    details: string,
    ipAddress?: string
  ): Promise<void> {
    try {
      await pbAdmin.collection("audit_logs").create({
        organization: organizationId,
        user: userId,
        action,
        details,
        ipAddress: ipAddress || "127.0.0.1",
      });
    } catch (err) {
      console.error("Erro crítico ao gravar audit_logs:", err);
    }
  }
}
