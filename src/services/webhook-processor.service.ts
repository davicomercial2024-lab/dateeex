import { pbAdmin } from "@/lib/pb";
import { MercadoLivreApiService } from "./mercado-livre-api.service";

/**
 * Serviço responsável pelo processamento assíncrono dos eventos de webhook
 * recebidos do Mercado Livre. Cada handler é isolado em try/catch para
 * garantir que um erro em um topic não afete os outros.
 */
export class WebhookProcessorService {
  /**
   * Ponto de entrada principal. Identifica a conta ML pelo user_id,
   * despacha para o handler correto conforme o topic/resource,
   * e atualiza o status do WebhookEvent no banco.
   */
  static async process(webhookEventId: string): Promise<void> {
    // Carrega o evento salvo
    let event;
    try {
      event = await pbAdmin.collection('webhook_events').getOne(webhookEventId);
    } catch (err) {
      return;
    }

    if (!event) return;

    // Marca como "processing"
    await pbAdmin.collection('webhook_events').update(webhookEventId, { status: "processing" });

    try {
      const meliUserId = event.userIdMercadoLivre;

      if (!meliUserId) {
        await this.markIgnored(webhookEventId, "user_id ausente no payload");
        return;
      }

      // Localiza a MercadoLivreAccount pelo meliUserId
      const accounts = await pbAdmin.collection('mercado_livre_accounts').getFullList({
        filter: `meliUserId="${meliUserId}"`,
      });
      const account = accounts[0];

      if (!account) {
        await this.markIgnored(
          webhookEventId,
          `Nenhuma conta encontrada para o meliUserId=${meliUserId}`
        );
        return;
      }

      // Valida token
      const tokens = await pbAdmin.collection('oauth_tokens').getFullList({
        filter: `account="${account.id}"`,
      });
      const token = tokens[0];

      if (!token) {
        await this.markError(webhookEventId, "Conta sem token OAuth. Necessário reconectar.");
        return;
      }

      // Renova token se necessário (mock token: avança expiração; real: chama API)
      let accessToken = token.accessToken;
      const now = new Date();
      const expiresAt = new Date(token.expiresAt);
      const isExpiring = expiresAt.getTime() - now.getTime() < 5 * 60 * 1000;

      if (isExpiring) {
        try {
          if (token.accessToken.includes("mock-token")) {
            await pbAdmin.collection('oauth_tokens').update(token.id, {
              expiresAt: new Date(Date.now() + 6 * 3600 * 1000).toISOString()
            });
          } else {
            const refreshed = await MercadoLivreApiService.refreshToken(
              token.refreshToken
            );
            accessToken = refreshed.access_token;
            await pbAdmin.collection('oauth_tokens').update(token.id, {
              accessToken: refreshed.access_token,
              refreshToken: refreshed.refresh_token,
              expiresAt: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
            });
          }
        } catch (err: any) {
          await this.markError(
            webhookEventId,
            `Falha ao renovar token: ${err.message}`
          );
          return;
        }
      }

      // Se token simulado, não bate na API real — apenas registra como processed
      if (accessToken.includes("mock-token")) {
        await this.markProcessed(webhookEventId);
        return;
      }

      const topic = event.topic.toLowerCase();
      const resource = event.resource.toLowerCase();

      // ── Despacha conforme topic / resource ──────────────────────────────
      if (topic.includes("orders") || resource.includes("/orders")) {
        await this.syncOrderFromResource(
          event.resource,
          accessToken,
          account.id,
          account.organization
        );
      } else if (topic.includes("items") || resource.includes("/items")) {
        await this.syncItemFromResource(
          event.resource,
          accessToken,
          account.id,
          account.organization,
          account.meliUserId
        );
      } else if (topic.includes("questions") || resource.includes("/questions")) {
        await this.syncQuestionsForAccount(
          account.meliUserId,
          accessToken,
          account.id,
          account.organization
        );
      } else if (topic.includes("shipments") || resource.includes("/shipments")) {
        await this.syncShipmentFromResource(
          event.resource,
          accessToken,
          account.id
        );
      } else if (topic.includes("claims") || resource.includes("/claims")) {
        // Claims requerem sincronização completa de pedidos (relacionamento)
        await this.markIgnored(webhookEventId, `Topic 'claims' registrado mas sem handler dedicado ainda. Resource: ${event.resource}`);
        return;
      } else {
        await this.markIgnored(
          webhookEventId,
          `Topic '${event.topic}' não reconhecido. Resource: ${event.resource}`
        );
        return;
      }

      await this.markProcessed(webhookEventId);
    } catch (err: any) {
      const msg = err?.message || String(err);
      console.error(`[WebhookProcessor] Erro ao processar evento ${webhookEventId}:`, msg);
      await this.markError(webhookEventId, msg);
    }
  }

  // ─── Handlers pontuais de sincronização ───────────────────────────────────

  /**
   * Sincroniza um único pedido a partir do resource path (ex: /orders/2000123456789)
   */
  private static async syncOrderFromResource(
    resource: string,
    accessToken: string,
    accountId: string,
    organizationId: string
  ): Promise<void> {
    // Extrai o ID numérico do resource path
    const orderId = resource.split("/orders/")[1]?.split("?")[0];
    if (!orderId) return;

    const order = await MercadoLivreApiService.fetchOrder(orderId, accessToken);

    if (!order || !order.id) return;

    const orderData = {
      organization: organizationId,
      account: accountId,
      mlOrderId: order.id.toString(),
      status: order.status,
      totalAmount: order.total_amount,
      buyerNickname: order.buyer?.nickname || "Desconhecido",
      dateCreated: order.date_created ? new Date(order.date_created).toISOString() : undefined,
      currencyId: order.currency_id,
      itemCount: order.order_items?.length || 0,
    };

    const existingOrders = await pbAdmin.collection('orders').getFullList({
      filter: `account="${accountId}" && mlOrderId="${order.id}"`
    });

    let localOrderId;
    if (existingOrders.length > 0) {
      localOrderId = existingOrders[0].id;
      await pbAdmin.collection('orders').update(localOrderId, orderData);
    } else {
      const newOrder = await pbAdmin.collection('orders').create(orderData);
      localOrderId = newOrder.id;
    }

    // Recria os order items se a coleção existir
    try {
      const existingItems = await pbAdmin.collection('order_items').getFullList({
        filter: `order="${localOrderId}"`
      });
      for (const item of existingItems) {
        await pbAdmin.collection('order_items').delete(item.id);
      }
      if (order.order_items?.length) {
        for (const item of order.order_items) {
          await pbAdmin.collection('order_items').create({
            order: localOrderId,
            mlItemId: item.item.id,
            title: item.item.title,
            quantity: item.quantity || 1,
            unitPrice: item.unit_price,
          });
        }
      }
    } catch (e) {
      // Ignora se a coleção order_items não existir no PocketBase
    }

    // Sincroniza envio se presente
    if (order.shipping?.id) {
      try {
        const shipment = await MercadoLivreApiService.fetchShipment(
          order.shipping.id.toString(),
          accessToken
        );
        const shipmentData = {
          order: localOrderId,
          account: accountId,
          mlShipmentId: shipment.id.toString(),
          status: shipment.status,
          trackingNumber: shipment.tracking_number,
          trackingMethod: shipment.tracking_method,
          serviceId: shipment.service_id,
          dateCreated: shipment.date_created ? new Date(shipment.date_created).toISOString() : undefined,
          dateFirstPrinted: shipment.date_first_printed ? new Date(shipment.date_first_printed).toISOString() : null,
          dateShipped: shipment.status_history?.date_shipped ? new Date(shipment.status_history.date_shipped).toISOString() : null,
          dateDelivered: shipment.status_history?.date_delivered ? new Date(shipment.status_history.date_delivered).toISOString() : null,
        };

        const existingShipments = await pbAdmin.collection('shipments').getFullList({
          filter: `order="${localOrderId}"`
        });

        if (existingShipments.length > 0) {
          await pbAdmin.collection('shipments').update(existingShipments[0].id, shipmentData);
        } else {
          await pbAdmin.collection('shipments').create(shipmentData);
        }
      } catch {
        // Erro de envio não bloqueia o pedido ou a coleção não existe
      }
    }
  }

  /**
   * Sincroniza um único anúncio a partir do resource path (ex: /items/MLB123456789)
   */
  private static async syncItemFromResource(
    resource: string,
    accessToken: string,
    accountId: string,
    organizationId: string,
    meliUserId: string
  ): Promise<void> {
    const mlItemId = resource.split("/items/")[1]?.split("?")[0];
    if (!mlItemId) return;

    const item = await MercadoLivreApiService.fetchItem(mlItemId, accessToken);

    if (!item || !item.id) return;

    const listingData = {
      organization: organizationId,
      account: accountId,
      mlItemId: item.id,
      title: item.title,
      price: item.price,
      availableQuantity: item.available_quantity || 0,
      soldQuantity: item.sold_quantity || 0,
      status: item.status,
      permalink: item.permalink,
      thumbnail: item.thumbnail,
      condition: item.condition,
      catalogProductId: item.catalog_product_id,
      health: item.health,
    };

    const existingListings = await pbAdmin.collection('listings').getFullList({
      filter: `account="${accountId}" && mlItemId="${item.id}"`
    });

    if (existingListings.length > 0) {
      await pbAdmin.collection('listings').update(existingListings[0].id, listingData);
    } else {
      await pbAdmin.collection('listings').create(listingData);
    }
  }

  /**
   * Sincroniza perguntas recentes do vendedor
   */
  private static async syncQuestionsForAccount(
    meliUserId: string,
    accessToken: string,
    accountId: string,
    organizationId: string
  ): Promise<void> {
    const questions = await MercadoLivreApiService.fetchQuestions(
      meliUserId,
      accessToken
    );

    for (const q of questions) {
      const questionData = {
        organization: organizationId,
        account: accountId,
        mlQuestionId: q.id.toString(),
        itemId: q.item_id,
        text: q.text,
        status: q.status,
        answer: q.answer?.text || null,
        dateCreated: q.date_created ? new Date(q.date_created).toISOString() : undefined,
      };

      const existingQuestions = await pbAdmin.collection('questions').getFullList({
        filter: `account="${accountId}" && mlQuestionId="${q.id}"`
      });

      if (existingQuestions.length > 0) {
        await pbAdmin.collection('questions').update(existingQuestions[0].id, questionData);
      } else {
        await pbAdmin.collection('questions').create(questionData);
      }
    }
  }

  /**
   * Sincroniza um envio pontual a partir do resource path (ex: /shipments/12345)
   */
  private static async syncShipmentFromResource(
    resource: string,
    accessToken: string,
    accountId: string
  ): Promise<void> {
    const shipmentId = resource.split("/shipments/")[1]?.split("?")[0];
    if (!shipmentId) return;

    const shipment = await MercadoLivreApiService.fetchShipment(
      shipmentId,
      accessToken
    );
    if (!shipment || !shipment.id) return;

    try {
      // Tenta encontrar o envio existente para atualizar
      const existingShipments = await pbAdmin.collection('shipments').getFullList({
        filter: `mlShipmentId="${shipment.id}"`
      });

      if (existingShipments.length === 0) return; // Sem pedido vinculado no momento, ignora

      const shipmentData = {
        status: shipment.status,
        trackingNumber: shipment.tracking_number,
        trackingMethod: shipment.tracking_method,
        dateFirstPrinted: shipment.date_first_printed ? new Date(shipment.date_first_printed).toISOString() : null,
        dateShipped: shipment.status_history?.date_shipped ? new Date(shipment.status_history.date_shipped).toISOString() : null,
        dateDelivered: shipment.status_history?.date_delivered ? new Date(shipment.status_history.date_delivered).toISOString() : null,
      };

      await pbAdmin.collection('shipments').update(existingShipments[0].id, shipmentData);
    } catch (e) {
      // Ignora se a coleção shipments não existir
    }
  }

  // ─── Helpers de status ────────────────────────────────────────────────────

  private static async markProcessed(id: string): Promise<void> {
    try {
      await pbAdmin.collection('webhook_events').update(id, { status: "processed" });
    } catch (e) {}
  }

  private static async markIgnored(id: string, reason: string): Promise<void> {
    try {
      await pbAdmin.collection('webhook_events').update(id, {
        status: "ignored",
      });
      console.log(`[WebhookProcessor] Evento ${id} ignorado: ${reason}`);
    } catch (e) {}
  }

  private static async markError(id: string, message: string): Promise<void> {
    try {
      await pbAdmin.collection('webhook_events').update(id, { status: "error" });
      console.error(`[WebhookProcessor] Evento ${id} erro: ${message}`);
    } catch (e) {}
  }
}
