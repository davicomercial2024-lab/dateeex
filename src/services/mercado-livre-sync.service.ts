import { pbAdmin } from "@/lib/pb";
import { MercadoLivreApiService } from "./mercado-livre-api.service";

const TOKEN_REFRESH_SKEW_MS = 5 * 60 * 1000;
const PB_LOOKUP_CHUNK_SIZE = 50;
const PB_WRITE_CONCURRENCY = 10;

export class MercadoLivreSyncService {
  private static isNonRetryableTokenError(err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return (
      message.includes("unsupported_grant_type") ||
      message.includes("invalid_grant") ||
      message.includes("Refresh token ausente")
    );
  }

  private static async runWithConcurrency<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>) {
    for (let i = 0; i < items.length; i += concurrency) {
      await Promise.all(items.slice(i, i + concurrency).map(worker));
    }
  }

  private static async getExistingByMlId(collection: string, accountId: string, field: string, ids: string[]) {
    const records: any[] = [];
    for (let i = 0; i < ids.length; i += PB_LOOKUP_CHUNK_SIZE) {
      const chunk = ids.slice(i, i + PB_LOOKUP_CHUNK_SIZE);
      const filterStr = chunk.map(id => `${field}="${id}"`).join(" || ");
      if (!filterStr) continue;

      try {
        const chunkRecords = await pbAdmin.collection(collection).getFullList({
          filter: `account="${accountId}" && (${filterStr})`,
          requestKey: null
        });
        records.push(...chunkRecords);
      } catch (err) {
        console.error(`Erro ao buscar registros existentes em ${collection}:`, err);
      }
    }

    return records;
  }

  private static async markTokenExpired(accountId: string) {
    await pbAdmin.collection("mercado_livre_accounts").update(accountId, {
      status: "EXPIRED",
      lastSyncStatus: "FAILED",
      lastSyncError: "Token expirado ou invalido. Reconecte a conta Mercado Livre.",
    }, { requestKey: null }).catch(() => null);
  }

  private static async refreshAndPersistToken(account: any, token: any) {
    try {
      const refreshed = await MercadoLivreApiService.refreshToken(token.refreshToken);
      if (!refreshed?.access_token) {
        throw new Error("Mercado Livre nao retornou access_token ao renovar.");
      }

      const updatedToken = await pbAdmin.collection("oauth_tokens").update(token.id, {
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token || token.refreshToken,
        expiresAt: new Date(Date.now() + (refreshed.expires_in || 21600) * 1000).toISOString(),
      }, { requestKey: null });

      await pbAdmin.collection("mercado_livre_accounts").update(account.id, {
        status: "CONNECTED",
        lastSyncError: null,
      }, { requestKey: null });

      return updatedToken;
    } catch (refreshErr) {
      console.error(`Erro ao renovar token da conta ${account.id}:`, refreshErr);
      if (this.isNonRetryableTokenError(refreshErr)) {
        await this.markTokenExpired(account.id);
      }
      throw refreshErr;
    }
  }

  private static async withTokenRetry<T>(account: any, token: any, operation: (accessToken: string) => Promise<T>) {
    try {
      return await operation(token.accessToken);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("Meli API Error [401]") && !token.accessToken.includes("mock")) {
        const refreshedToken = await this.refreshAndPersistToken(account, token);
        return operation(refreshedToken.accessToken);
      }
      throw err;
    }
  }

  static async getAccountAndToken(accountId: string, organizationId: string, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        const account = await pbAdmin.collection("mercado_livre_accounts").getFirstListItem(`id="${accountId}" && organization="${organizationId}"`, { requestKey: null });
        let token = await pbAdmin.collection("oauth_tokens").getFirstListItem(`account="${account.id}"`, { requestKey: null });

        const now = new Date();
        const isExpired = new Date(token.expiresAt).getTime() <= now.getTime() + TOKEN_REFRESH_SKEW_MS;

        if (isExpired && !token.accessToken.includes("mock")) {
          try {
            const refreshed = await MercadoLivreApiService.refreshToken(token.refreshToken);
            if (refreshed?.access_token) {
              token = await pbAdmin.collection("oauth_tokens").update(token.id, {
                accessToken: refreshed.access_token,
                refreshToken: refreshed.refresh_token || token.refreshToken,
                expiresAt: new Date(Date.now() + (refreshed.expires_in || 21600) * 1000).toISOString(),
              }, { requestKey: null });
              
              await pbAdmin.collection("mercado_livre_accounts").update(account.id, {
                status: "CONNECTED"
              }, { requestKey: null });
            }
          } catch (refreshErr) {
            console.error(`Erro ao renovar token da conta ${account.id}:`, refreshErr);
            if (this.isNonRetryableTokenError(refreshErr)) {
              await pbAdmin.collection("mercado_livre_accounts").update(account.id, {
                status: "EXPIRED",
                lastSyncStatus: "FAILED",
                lastSyncError: "Token expirado ou invÃ¡lido. Reconecte a conta Mercado Livre.",
              }, { requestKey: null }).catch(() => null);
            }
            throw refreshErr;
          }
        }

        return { account, token };
      } catch (err: any) {
        if (this.isNonRetryableTokenError(err)) {
          throw new Error(`getAccountAndToken failed: ${err.message}`);
        }
        if (i === retries - 1) {
          console.error(`Erro ao buscar account/token para accountId=${accountId}:`, err);
          throw new Error(`getAccountAndToken failed: ${err.message}`);
        }
        await new Promise(res => setTimeout(res, 500 * (i + 1))); // exponential backoff
      }
    }
    throw new Error("getAccountAndToken failed after retries");
  }

  static async syncDetailsAndReputation(accountId: string, organizationId: string): Promise<boolean> {
    const { account, token } = await this.getAccountAndToken(accountId, organizationId);
    if (token.accessToken.includes("mock")) return true;
    
    try {
      const details = await this.withTokenRetry(account, token, (accessToken) => MercadoLivreApiService.fetchAccountDetails(accessToken));
      await pbAdmin.collection("mercado_livre_accounts").update(account.id, {
        email: details.email || account.email,
        status: "CONNECTED",
      });

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

        try {
          const repRecord = await pbAdmin.collection("seller_reputations").getFirstListItem(`account="${accountId}"`, { requestKey: null });
          await pbAdmin.collection("seller_reputations").update(repRecord.id, repData, { requestKey: null });
        } catch(e) {
          await pbAdmin.collection("seller_reputations").create(repData, { requestKey: null });
        }
      }
      return true;
    } catch (err) {
      console.error("Erro ao sync details:", err);
      return false;
    }
  }

  static async syncListingsChunk(accountId: string, organizationId: string, scrollId: string | undefined, limit: number): Promise<{ hasMore: boolean, scrollId?: string, total: number }> {
    const { account, token } = await this.getAccountAndToken(accountId, organizationId);
    if (token.accessToken.includes("mock")) return { hasMore: false, total: 0 };

    const { items, scrollId: nextScrollId, total } = await this.withTokenRetry(account, token, (accessToken) =>
      MercadoLivreApiService.fetchListingsChunk(account.meliUserId, accessToken, scrollId, limit)
    );
    
    if (items.length > 0) {
      const ids = items.map(i => i.id);
      const existingRecords = await this.getExistingByMlId("listings", accountId, "mlItemId", ids);
      const existingMap = new Map(existingRecords.map(r => [r.mlItemId, r]));

      await this.runWithConcurrency(items, PB_WRITE_CONCURRENCY, async (item) => {
          if (!item) return;
          try {
            const itemData = {
              organization: organizationId,
              account: accountId,
              mlItemId: item.id,
              title: item.title,
              price: item.price,
              availableQuantity: item.available_quantity,
              soldQuantity: item.sold_quantity,
              status: item.status,
              permalink: item.permalink,
              thumbnail: item.thumbnail || "",
              catalogProductId: (item as any).catalog_product_id || ""
            };

            const existing = existingMap.get(item.id);
            if (existing) {
              await pbAdmin.collection("listings").update(existing.id, itemData, { requestKey: null });
            } else {
              await pbAdmin.collection("listings").create(itemData, { requestKey: null });
            }
          } catch (err) {
            console.error(`Erro ao processar item ${item.id}:`, err);
          }
      });
    }

    return { hasMore: nextScrollId ? true : false, scrollId: nextScrollId, total };
  }

  static async syncOrdersChunk(accountId: string, organizationId: string, offset: number, limit: number): Promise<{ hasMore: boolean, total: number }> {
    const { account, token } = await this.getAccountAndToken(accountId, organizationId);
    if (token.accessToken.includes("mock")) return { hasMore: false, total: 0 };

    const { orders, total } = await this.withTokenRetry(account, token, (accessToken) =>
      MercadoLivreApiService.fetchOrdersChunk(account.meliUserId, accessToken, offset, limit)
    );
    
    if (orders.length > 0) {
      const ids = orders.map(o => o.id.toString());
      const existingRecords = await this.getExistingByMlId("orders", accountId, "mlOrderId", ids);
      const existingMap = new Map(existingRecords.map(r => [r.mlOrderId, r]));

      await this.runWithConcurrency(orders, PB_WRITE_CONCURRENCY, async (order) => {
          try {
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

            const existing = existingMap.get(order.id.toString());
            if (existing) {
              await pbAdmin.collection("orders").update(existing.id, orderData, { requestKey: null });
            } else {
              await pbAdmin.collection("orders").create(orderData, { requestKey: null });
            }
          } catch (err) {
            console.error(`Erro ao processar order ${order.id}:`, err);
          }
      });
    }

    return { hasMore: offset + orders.length < total, total };
  }

  static async syncQuestionsChunk(accountId: string, organizationId: string, offset: number, limit: number): Promise<{ hasMore: boolean, total: number }> {
    const { account, token } = await this.getAccountAndToken(accountId, organizationId);
    if (token.accessToken.includes("mock")) return { hasMore: false, total: 0 };

    const { questions, total } = await this.withTokenRetry(account, token, (accessToken) =>
      MercadoLivreApiService.fetchQuestionsChunk(account.meliUserId, accessToken, offset, limit)
    );
    
    if (questions.length > 0) {
      const ids = questions.map(q => q.id.toString());
      const existingRecords = await this.getExistingByMlId("questions", accountId, "mlQuestionId", ids);
      const existingMap = new Map(existingRecords.map(r => [r.mlQuestionId, r]));

      await this.runWithConcurrency(questions, PB_WRITE_CONCURRENCY, async (question) => {
          try {
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

            const existing = existingMap.get(question.id.toString());
            if (existing) {
              await pbAdmin.collection("questions").update(existing.id, questionData, { requestKey: null });
            } else {
              await pbAdmin.collection("questions").create(questionData, { requestKey: null });
            }
          } catch (err) {
            console.error(`Erro ao processar question ${question.id}:`, err);
          }
      });
    }

    return { hasMore: offset + questions.length < total, total };
  }
}
