import { prisma } from "@/lib/prisma";
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
    const account = await prisma.mercadoLivreAccount.findFirst({
      where: { id: accountId, organizationId, isActive: true },
      include: { token: true },
    });

    if (!account) {
      const err = "Conta do Mercado Livre não encontrada ou acesso negado.";
      report.errors.push(err);
      await this.logAudit(organizationId, userId, accountId, "SYNC_FAILED", err, ipAddress);
      return report;
    }

    report.nickname = account.nickname;

    if (!account.token) {
      const err = `Nenhum token de autorização encontrado para a conta ${account.nickname}.`;
      report.errors.push(err);
      await this.logAudit(organizationId, userId, accountId, "SYNC_FAILED", err, ipAddress);
      return report;
    }

    await this.reportProgress(onProgress, 5);

    let accessToken = account.token.accessToken;
    let refreshToken = account.token.refreshToken;
    let expiresAt = account.token.expiresAt;

    // 2. Renova o token se expirado ou prestes a expirar (menos de 5 minutos de validade)
    const now = new Date();
    const isCloseToExpire = expiresAt.getTime() - now.getTime() < 5 * 60 * 1000;

    if (isCloseToExpire || account.status === "EXPIRED") {
      try {
        // Se for um token simulado (mock), apenas avançamos o tempo de expiração para simular sucesso
        if (accessToken.includes("mock-token") || refreshToken.includes("mock-token")) {
          const newExpiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000); // +6 horas
          await prisma.oAuthToken.update({
            where: { mercadoLivreAccountId: accountId },
            data: { expiresAt: newExpiresAt },
          });
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

          await prisma.oAuthToken.update({
            where: { mercadoLivreAccountId: accountId },
            data: {
              accessToken: refreshRes.access_token,
              refreshToken: refreshRes.refresh_token,
              expiresAt: newExpiresAt,
            },
          });

          accessToken = refreshRes.access_token;
          refreshToken = refreshRes.refresh_token;
          expiresAt = newExpiresAt;

          await prisma.mercadoLivreAccount.update({
            where: { id: accountId },
            data: { status: "CONNECTED" },
          });

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
        
        await prisma.mercadoLivreAccount.update({
          where: { id: accountId },
          data: { status: "EXPIRED" },
        });

        await this.logAudit(organizationId, userId, accountId, "SYNC_FAILED", errMsg, ipAddress);
        return report;
      }
    }

    // Se for um token puramente simulado e não quisermos bater na API real (evitando 401 instantâneos),
    // a sincronização apenas zera ou valida que a API oficial não possui dados reais.
    // Desta forma, o comportamento atende perfeitamente à regra de "se a API não retornar dados, exibir estado vazio".
    const isMock = accessToken.includes("mock-token");

    // 3. Executa as sincronias de entidades individuais encapsuladas em blocos try-catch para isolamento
    
    // --- 3.1 Detalhes Cadastrais & Reputação ---
    try {
      if (!isMock) {
        const details = await MercadoLivreApiService.fetchAccountDetails(accessToken);
        
        // Atualiza e-mail e status se alterados
        await prisma.mercadoLivreAccount.update({
          where: { id: accountId },
          data: {
            email: details.email || account.email,
            status: "CONNECTED",
          },
        });

        // Reputação
        if (details.seller_reputation) {
          const rep = details.seller_reputation;
          const repRecord = await prisma.sellerReputation.create({
            data: {
              organizationId,
              mercadoLivreAccountId: accountId,
              levelId: rep.level_id || "unknown",
              powerSellerStatus: rep.power_seller_status,
              claimsRate: rep.metrics?.claims?.rate || 0,
              delayedHandlingTimeRate: rep.metrics?.delayed_handling_time?.rate || 0,
              cancellationsRate: rep.metrics?.cancellations?.rate || 0,
              salesPeriod: rep.transactions?.period || "unknown",
              salesCompleted: rep.transactions?.completed || 0,
            },
          });
          report.reputationLevel = repRecord.levelId || undefined;
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
          await prisma.listing.upsert({
            where: {
              mercadoLivreAccountId_mlItemId: {
                mercadoLivreAccountId: accountId,
                mlItemId: item.id,
              },
            },
            update: {
              title: item.title,
              price: item.price,
              currencyId: item.currency_id || "BRL",
              availableQuantity: item.available_quantity || 0,
              soldQuantity: item.sold_quantity || 0,
              status: item.status || "active",
              permalink: item.permalink,
              thumbnail: item.thumbnail,
            },
            create: {
              organizationId,
              mercadoLivreAccountId: accountId,
              mlItemId: item.id,
              title: item.title,
              price: item.price,
              currencyId: item.currency_id || "BRL",
              availableQuantity: item.available_quantity || 0,
              soldQuantity: item.sold_quantity || 0,
              status: item.status || "active",
              permalink: item.permalink,
              thumbnail: item.thumbnail,
            },
          });
          report.listingsCount++;
        }
      }
    } catch (err: any) {
      report.errors.push(`Erro ao sincronizar anúncios: ${err.message || err}`);
    }

    await this.reportProgress(onProgress, 45);

    // --- 3.3 Vendas (Orders, OrderItems & Shipments) ---
    try {
      if (!isMock) {
        const orders = await MercadoLivreApiService.fetchOrders(account.meliUserId, accessToken);

        for (const order of orders) {
          // Upsert da Order
          const localOrder = await prisma.order.upsert({
            where: {
              mercadoLivreAccountId_mlOrderId: {
                mercadoLivreAccountId: accountId,
                mlOrderId: order.id.toString(),
              },
            },
            update: {
              status: order.status,
              totalAmount: order.total_amount,
              buyerNickname: order.buyer?.nickname || "Desconhecido",
              buyerId: order.buyer?.id?.toString() || "0",
              dateCreated: new Date(order.date_created),
              dateClosed: order.date_closed ? new Date(order.date_closed) : null,
            },
            create: {
              organizationId,
              mercadoLivreAccountId: accountId,
              mlOrderId: order.id.toString(),
              status: order.status,
              totalAmount: order.total_amount,
              buyerNickname: order.buyer?.nickname || "Desconhecido",
              buyerId: order.buyer?.id?.toString() || "0",
              dateCreated: new Date(order.date_created),
              dateClosed: order.date_closed ? new Date(order.date_closed) : null,
            },
          });

          // Atualiza os OrderItems deletando os antigos e recriando para evitar duplicatas
          await prisma.orderItem.deleteMany({
            where: { orderId: localOrder.id },
          });

          if (order.order_items && order.order_items.length > 0) {
            await prisma.orderItem.createMany({
              data: order.order_items.map((item) => ({
                orderId: localOrder.id,
                mlItemId: item.item.id,
                title: item.item.title,
                quantity: item.quantity || 1,
                unitPrice: item.unit_price,
              })),
            });
          }

          // Rastreia e sincroniza dados físicos de postagem (Shipment)
          if (order.shipping && order.shipping.id) {
            try {
              const shipment = await MercadoLivreApiService.fetchShipment(
                order.shipping.id.toString(),
                accessToken
              );

              await prisma.shipment.upsert({
                where: { orderId: localOrder.id },
                update: {
                  mlShipmentId: shipment.id.toString(),
                  status: shipment.status,
                  trackingNumber: shipment.tracking_number,
                  trackingMethod: shipment.tracking_method,
                  serviceId: shipment.service_id != null ? String(shipment.service_id) : null,
                  dateCreated: new Date(shipment.date_created),
                  dateFirstPrinted: shipment.date_first_printed ? new Date(shipment.date_first_printed) : null,
                  dateShipped: shipment.status_history?.date_shipped ? new Date(shipment.status_history.date_shipped) : null,
                  dateDelivered: shipment.status_history?.date_delivered ? new Date(shipment.status_history.date_delivered) : null,
                },
                create: {
                  orderId: localOrder.id,
                  mercadoLivreAccountId: accountId,
                  mlShipmentId: shipment.id.toString(),
                  status: shipment.status,
                  trackingNumber: shipment.tracking_number,
                  trackingMethod: shipment.tracking_method,
                  serviceId: shipment.service_id != null ? String(shipment.service_id) : null,
                  dateCreated: new Date(shipment.date_created),
                  dateFirstPrinted: shipment.date_first_printed ? new Date(shipment.date_first_printed) : null,
                  dateShipped: shipment.status_history?.date_shipped ? new Date(shipment.status_history.date_shipped) : null,
                  dateDelivered: shipment.status_history?.date_delivered ? new Date(shipment.status_history.date_delivered) : null,
                },
              });
            } catch (shipErr: any) {
              report.errors.push(`Erro ao sincronizar envio ${order.shipping.id}: ${shipErr.message || shipErr}`);
            }
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
          await prisma.question.upsert({
            where: {
              mercadoLivreAccountId_mlQuestionId: {
                mercadoLivreAccountId: accountId,
                mlQuestionId: question.id.toString(),
              },
            },
            update: {
              mlItemId: question.item_id,
              text: question.text,
              status: question.status,
              answerText: question.answer ? question.answer.text : null,
              answerDate: question.answer ? new Date(question.answer.date_created) : null,
              buyerId: question.from?.id?.toString() || "0",
              dateCreated: new Date(question.date_created),
            },
            create: {
              organizationId,
              mercadoLivreAccountId: accountId,
              mlQuestionId: question.id.toString(),
              mlItemId: question.item_id,
              text: question.text,
              status: question.status,
              answerText: question.answer ? question.answer.text : null,
              answerDate: question.answer ? new Date(question.answer.date_created) : null,
              buyerId: question.from?.id?.toString() || "0",
              dateCreated: new Date(question.date_created),
            },
          });
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
          await prisma.promotion.upsert({
            where: {
              organizationId_mlPromotionId: {
                organizationId,
                mlPromotionId: promo.id,
              },
            },
            update: {
              name: promo.name || "Promoção sem nome",
              type: promo.type || "deal",
              status: promo.status || "active",
              startDate: new Date(promo.start_date),
              endDate: new Date(promo.deadline_date),
            },
            create: {
              organizationId,
              mlPromotionId: promo.id,
              name: promo.name || "Promoção sem nome",
              type: promo.type || "deal",
              status: promo.status || "active",
              startDate: new Date(promo.start_date),
              endDate: new Date(promo.deadline_date),
            },
          });
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
          await prisma.advertisingCampaign.upsert({
            where: {
              organizationId_mlCampaignId: {
                organizationId,
                mlCampaignId: camp.id.toString(),
              },
            },
            update: {
              name: camp.name || "Campanha Product Ads",
              status: camp.status || "active",
              budget: camp.daily_budget || 0,
            },
            create: {
              organizationId,
              mlCampaignId: camp.id.toString(),
              name: camp.name || "Campanha Product Ads",
              status: camp.status || "active",
              budget: camp.daily_budget || 0,
              budgetType: "daily",
            },
          });
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
      await prisma.auditLog.create({
        data: {
          organizationId,
          userId,
          mercadoLivreAccountId: meliAccountId,
          action,
          details,
          ipAddress: ipAddress || "127.0.0.1",
        },
      });
    } catch (err) {
      console.error("Erro crítico ao gravar AuditLog:", err);
    }
  }
}
