import { pbAdmin } from "@/lib/pb";
import { MercadoLivreApiService } from "./mercado-livre-api.service";

export class MercadoLivreSyncService {
  static async getAccountAndToken(accountId: string, organizationId: string) {
    const account = await pbAdmin.collection("mercado_livre_accounts").getFirstListItem(`id="${accountId}" && organization="${organizationId}"`);
    const token = await pbAdmin.collection("oauth_tokens").getFirstListItem(`account="${account.id}"`);
    return { account, token };
  }

  static async syncDetailsAndReputation(accountId: string, organizationId: string): Promise<boolean> {
    const { account, token } = await this.getAccountAndToken(accountId, organizationId);
    if (token.accessToken.includes("mock")) return true;
    
    try {
      const details = await MercadoLivreApiService.fetchAccountDetails(token.accessToken);
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
          const repRecord = await pbAdmin.collection("seller_reputations").getFirstListItem(`account="${accountId}"`);
          await pbAdmin.collection("seller_reputations").update(repRecord.id, repData);
        } catch(e) {
          await pbAdmin.collection("seller_reputations").create(repData);
        }
      }
      return true;
    } catch (err) {
      console.error("Erro ao sync details:", err);
      return false;
    }
  }

  static async syncListingsChunk(accountId: string, organizationId: string, offset: number, limit: number): Promise<{ hasMore: boolean, total: number }> {
    const { account, token } = await this.getAccountAndToken(accountId, organizationId);
    if (token.accessToken.includes("mock")) return { hasMore: false, total: 0 };

    const { items, total } = await MercadoLivreApiService.fetchListingsChunk(account.meliUserId, token.accessToken, offset, limit);
    
    await Promise.all(items.map(async (item) => {
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
    }));

    return { hasMore: offset + items.length < total, total };
  }

  static async syncOrdersChunk(accountId: string, organizationId: string, offset: number, limit: number): Promise<{ hasMore: boolean, total: number }> {
    const { account, token } = await this.getAccountAndToken(accountId, organizationId);
    if (token.accessToken.includes("mock")) return { hasMore: false, total: 0 };

    const { orders, total } = await MercadoLivreApiService.fetchOrdersChunk(account.meliUserId, token.accessToken, offset, limit);
    
    await Promise.all(orders.map(async (order) => {
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
    }));

    return { hasMore: offset + orders.length < total, total };
  }

  static async syncQuestionsChunk(accountId: string, organizationId: string, offset: number, limit: number): Promise<{ hasMore: boolean, total: number }> {
    const { account, token } = await this.getAccountAndToken(accountId, organizationId);
    if (token.accessToken.includes("mock")) return { hasMore: false, total: 0 };

    const { questions, total } = await MercadoLivreApiService.fetchQuestionsChunk(account.meliUserId, token.accessToken, offset, limit);
    
    await Promise.all(questions.map(async (question) => {
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
    }));

    return { hasMore: offset + questions.length < total, total };
  }
}
