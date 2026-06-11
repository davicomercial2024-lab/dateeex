import { prisma } from "@/lib/prisma";
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
    const event = await prisma.webhookEvent.findUnique({
      where: { id: webhookEventId },
    });

    if (!event) return;

    // Marca como "processing"
    await prisma.webhookEvent.update({
      where: { id: webhookEventId },
      data: { status: "processing" },
    });

    try {
      const meliUserId = event.userIdMercadoLivre;

      if (!meliUserId) {
        await this.markIgnored(webhookEventId, "user_id ausente no payload");
        return;
      }

      // Localiza a MercadoLivreAccount pelo meliUserId
      const account = await prisma.mercadoLivreAccount.findFirst({
        where: { meliUserId },
        include: { token: true },
      });

      if (!account) {
        await this.markIgnored(
          webhookEventId,
          `Nenhuma conta encontrada para o meliUserId=${meliUserId}`
        );
        return;
      }

      // Atualiza o evento com o account_id identificado
      await prisma.webhookEvent.update({
        where: { id: webhookEventId },
        data: { mercadoLivreAccountId: account.id },
      });

      // Valida token
      if (!account.token) {
        await this.markError(webhookEventId, "Conta sem token OAuth. Necessário reconectar.");
        return;
      }

      // Renova token se necessário (mock token: avança expiração; real: chama API)
      let accessToken = account.token.accessToken;
      const now = new Date();
      const isExpiring =
        account.token.expiresAt.getTime() - now.getTime() < 5 * 60 * 1000;

      if (isExpiring) {
        try {
          if (account.token.accessToken.includes("mock-token")) {
            await prisma.oAuthToken.update({
              where: { mercadoLivreAccountId: account.id },
              data: { expiresAt: new Date(Date.now() + 6 * 3600 * 1000) },
            });
          } else {
            const refreshed = await MercadoLivreApiService.refreshToken(
              account.token.refreshToken
            );
            accessToken = refreshed.access_token;
            await prisma.oAuthToken.update({
              where: { mercadoLivreAccountId: account.id },
              data: {
                accessToken: refreshed.access_token,
                refreshToken: refreshed.refresh_token,
                expiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
              },
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
          account.organizationId
        );
      } else if (topic.includes("items") || resource.includes("/items")) {
        await this.syncItemFromResource(
          event.resource,
          accessToken,
          account.id,
          account.organizationId,
          account.meliUserId
        );
      } else if (topic.includes("questions") || resource.includes("/questions")) {
        await this.syncQuestionsForAccount(
          account.meliUserId,
          accessToken,
          account.id,
          account.organizationId
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

    // Recria os order items
    await prisma.orderItem.deleteMany({ where: { orderId: localOrder.id } });
    if (order.order_items?.length) {
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

    // Sincroniza envio se presente
    if (order.shipping?.id) {
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
            serviceId: shipment.service_id,
            dateFirstPrinted: shipment.date_first_printed
              ? new Date(shipment.date_first_printed)
              : null,
            dateShipped: shipment.status_history?.date_shipped
              ? new Date(shipment.status_history.date_shipped)
              : null,
            dateDelivered: shipment.status_history?.date_delivered
              ? new Date(shipment.status_history.date_delivered)
              : null,
          },
          create: {
            orderId: localOrder.id,
            mercadoLivreAccountId: accountId,
            mlShipmentId: shipment.id.toString(),
            status: shipment.status,
            trackingNumber: shipment.tracking_number,
            trackingMethod: shipment.tracking_method,
            serviceId: shipment.service_id,
            dateCreated: new Date(shipment.date_created),
            dateFirstPrinted: shipment.date_first_printed
              ? new Date(shipment.date_first_printed)
              : null,
            dateShipped: shipment.status_history?.date_shipped
              ? new Date(shipment.status_history.date_shipped)
              : null,
            dateDelivered: shipment.status_history?.date_delivered
              ? new Date(shipment.status_history.date_delivered)
              : null,
          },
        });
      } catch {
        // Erro de envio não bloqueia o pedido
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
        status: item.status,
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
        status: item.status,
        permalink: item.permalink,
        thumbnail: item.thumbnail,
      },
    });
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
      await prisma.question.upsert({
        where: {
          mercadoLivreAccountId_mlQuestionId: {
            mercadoLivreAccountId: accountId,
            mlQuestionId: q.id.toString(),
          },
        },
        update: {
          text: q.text,
          status: q.status,
          answerText: q.answer?.text || null,
          answerDate: q.answer ? new Date(q.answer.date_created) : null,
        },
        create: {
          organizationId,
          mercadoLivreAccountId: accountId,
          mlQuestionId: q.id.toString(),
          mlItemId: q.item_id,
          text: q.text,
          status: q.status,
          answerText: q.answer?.text || null,
          answerDate: q.answer ? new Date(q.answer.date_created) : null,
          buyerId: q.from?.id?.toString() || "0",
          dateCreated: new Date(q.date_created),
        },
      });
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

    // Tenta encontrar o pedido vinculado para upsert do envio
    const existingShipment = await prisma.shipment.findFirst({
      where: { mlShipmentId: shipment.id.toString() },
    });

    if (!existingShipment) return; // Sem pedido vinculado, ignora

    await prisma.shipment.update({
      where: { id: existingShipment.id },
      data: {
        status: shipment.status,
        trackingNumber: shipment.tracking_number,
        trackingMethod: shipment.tracking_method,
        dateFirstPrinted: shipment.date_first_printed
          ? new Date(shipment.date_first_printed)
          : null,
        dateShipped: shipment.status_history?.date_shipped
          ? new Date(shipment.status_history.date_shipped)
          : null,
        dateDelivered: shipment.status_history?.date_delivered
          ? new Date(shipment.status_history.date_delivered)
          : null,
      },
    });
  }

  // ─── Helpers de status ────────────────────────────────────────────────────

  private static async markProcessed(id: string): Promise<void> {
    await prisma.webhookEvent.update({
      where: { id },
      data: { status: "processed", processedAt: new Date() },
    });
  }

  private static async markIgnored(id: string, reason: string): Promise<void> {
    await prisma.webhookEvent.update({
      where: { id },
      data: {
        status: "ignored",
        processedAt: new Date(),
        errorMessage: reason,
      },
    });
  }

  private static async markError(id: string, message: string): Promise<void> {
    await prisma.webhookEvent.update({
      where: { id },
      data: { status: "error", errorMessage: message },
    });
  }
}
