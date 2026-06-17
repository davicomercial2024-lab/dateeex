export interface MeliUserPayload {
  id: number;
  nickname: string;
  email: string;
  seller_reputation: {
    level_id: string;
    power_seller_status: string | null;
    metrics: {
      claims: {
        rate: number;
        value: number;
      };
      delayed_handling_time: {
        rate: number;
        value: number;
      };
      cancellations: {
        rate: number;
        value: number;
      };
    };
    transactions: {
      period: string;
      completed: number;
    };
  };
}

export interface MeliItemPayload {
  id: string;
  title: string;
  price: number;
  currency_id: string;
  available_quantity: number;
  sold_quantity: number;
  status: string;
  permalink: string;
  thumbnail: string;
}

export interface MeliOrderPayload {
  id: number;
  status: string;
  total_amount: number;
  buyer: {
    id: number;
    nickname: string;
  };
  date_created: string;
  date_closed: string | null;
  order_items: Array<{
    item: {
      id: string;
      title: string;
    };
    quantity: number;
    unit_price: number;
  }>;
  shipping?: {
    id: number;
  };
}

export interface MeliShipmentPayload {
  id: number;
  status: string;
  tracking_number: string | null;
  tracking_method: string | null;
  service_id: string | null;
  date_created: string;
  date_first_printed: string | null;
  status_history: {
    date_shipped: string | null;
    date_delivered: string | null;
  };
}

export interface MeliQuestionPayload {
  id: number;
  item_id: string;
  text: string;
  status: string;
  answer?: {
    text: string;
    date_created: string;
  } | null;
  from: {
    id: number;
  };
  date_created: string;
}

export interface MeliPromotionPayload {
  id: string;
  name: string;
  type: string;
  status: string;
  start_date: string;
  deadline_date: string;
}

export interface MeliCampaignPayload {
  id: number;
  name: string;
  status: string;
  daily_budget: number;
}

export interface MeliAdvertisingAdvertiser {
  advertiser_id: number;
  site_id: string;
  advertiser_name: string;
  account_name: string;
}

export interface MeliAdvertisingMetricSet {
  clicks?: number;
  prints?: number;
  ctr?: number;
  cost?: number;
  cpc?: number;
  acos?: number;
  organic_units_quantity?: number;
  organic_units_amount?: number;
  organic_items_quantity?: number;
  direct_items_quantity?: number;
  indirect_items_quantity?: number;
  advertising_items_quantity?: number;
  cvr?: number;
  roas?: number;
  sov?: number;
  direct_units_quantity?: number;
  indirect_units_quantity?: number;
  units_quantity?: number;
  direct_amount?: number;
  indirect_amount?: number;
  total_amount?: number;
  impression_share?: number;
  top_impression_share?: number;
  lost_impression_share_by_budget?: number;
  lost_impression_share_by_ad_rank?: number;
  acos_benchmark?: number;
}

export interface MeliProductAdsCampaign {
  id: number;
  name: string;
  status: string;
  last_updated?: string;
  date_created?: string;
  strategy?: string;
  acos_target?: number;
  roas_target?: number;
  channel?: string;
  advertiser_id?: number;
  budget?: number;
  automatic_budget?: boolean;
  currency_id?: string;
  metrics?: MeliAdvertisingMetricSet;
}

export interface MeliProductAd {
  id: string;
  item_id?: string;
  title?: string;
  status?: string;
  price?: number;
  currency_id?: string;
  campaign_id?: number;
  campaign_name?: string;
  thumbnail?: string;
  permalink?: string;
  recommended?: boolean;
  buy_box_winner?: boolean;
  channel?: string;
  metrics?: MeliAdvertisingMetricSet;
  metrics_summary?: MeliAdvertisingMetricSet;
}

const PRODUCT_ADS_METRICS = [
  "clicks",
  "prints",
  "ctr",
  "cost",
  "cpc",
  "acos",
  "organic_units_quantity",
  "organic_units_amount",
  "organic_items_quantity",
  "direct_items_quantity",
  "indirect_items_quantity",
  "advertising_items_quantity",
  "cvr",
  "roas",
  "sov",
  "direct_units_quantity",
  "indirect_units_quantity",
  "units_quantity",
  "direct_amount",
  "indirect_amount",
  "total_amount",
  "impression_share",
  "top_impression_share",
  "lost_impression_share_by_budget",
  "lost_impression_share_by_ad_rank",
  "acos_benchmark",
].join(",");

export class MercadoLivreApiService {
  private static BASE_URL = "https://api.mercadolibre.com";

  private static async request<T>(endpoint: string, accessToken: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.BASE_URL}${endpoint}`;
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...options.headers,
    };

    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Sem detalhes do erro");
      throw new Error(`Meli API Error [${response.status}]: ${errorText}`);
    }

    return response.json() as Promise<T>;
  }

  private static async advertisingRequest<T>(
    endpoint: string,
    accessToken: string,
    apiVersion: "1" | "2",
    options: RequestInit = {}
  ): Promise<T> {
    return this.request<T>(endpoint, accessToken, {
      ...options,
      headers: {
        ...(options.headers || {}),
        "Api-Version": apiVersion,
        "api-version": apiVersion,
      },
    });
  }

  static async fetchAdvertisingAdvertisers(
    accessToken: string,
    productId: "PADS" | "DISPLAY" | "BADS"
  ): Promise<MeliAdvertisingAdvertiser[]> {
    const response = await this.advertisingRequest<{ advertisers?: MeliAdvertisingAdvertiser[] }>(
      `/advertising/advertisers?product_id=${productId}`,
      accessToken,
      "1"
    );

    return response.advertisers || [];
  }

  static async fetchProductAdsCampaigns(params: {
    accessToken: string;
    advertiserSiteId: string;
    advertiserId: number;
    dateFrom: string;
    dateTo: string;
    limit?: number;
    offset?: number;
    status?: string;
    aggregationType?: "sum" | "DAILY";
    metricsSummary?: boolean;
  }): Promise<{ paging?: { total: number; offset: number; limit: number }; results: MeliProductAdsCampaign[] }> {
    const searchParams = new URLSearchParams({
      limit: String(params.limit ?? 50),
      offset: String(params.offset ?? 0),
      date_from: params.dateFrom,
      date_to: params.dateTo,
      metrics: PRODUCT_ADS_METRICS,
    });

    if (params.status && params.status !== "all") {
      searchParams.set("filters[status]", params.status);
    }
    if (params.aggregationType === "DAILY") {
      searchParams.set("aggregation_type", "DAILY");
    }
    if (params.metricsSummary) {
      searchParams.set("metrics_summary", "true");
    }

    const response = await this.advertisingRequest<{
      paging?: { total: number; offset: number; limit: number };
      results?: MeliProductAdsCampaign[];
    }>(
      `/advertising/${params.advertiserSiteId}/advertisers/${params.advertiserId}/product_ads/campaigns/search?${searchParams.toString()}`,
      params.accessToken,
      "2"
    );

    return { paging: response.paging, results: response.results || [] };
  }

  static async fetchProductAds(params: {
    accessToken: string;
    advertiserSiteId: string;
    advertiserId: number;
    dateFrom: string;
    dateTo: string;
    limit?: number;
    offset?: number;
    status?: string;
    campaignId?: string;
    recommendedOnly?: boolean;
  }): Promise<{ paging?: { total: number; offset: number; limit: number }; results: MeliProductAd[] }> {
    const searchParams = new URLSearchParams({
      limit: String(params.limit ?? 50),
      offset: String(params.offset ?? 0),
      date_from: params.dateFrom,
      date_to: params.dateTo,
      metrics: PRODUCT_ADS_METRICS,
    });

    if (params.status && params.status !== "all") {
      searchParams.set("filters[statuses]", params.status);
    }
    if (params.campaignId && params.campaignId !== "all") {
      searchParams.set("filters[campaign_id]", params.campaignId);
    }
    if (params.recommendedOnly) {
      searchParams.set("filters[recommended]", "true");
    }

    const response = await this.advertisingRequest<{
      paging?: { total: number; offset: number; limit: number };
      results?: MeliProductAd[];
    }>(
      `/advertising/${params.advertiserSiteId}/advertisers/${params.advertiserId}/product_ads/ads/search?${searchParams.toString()}`,
      params.accessToken,
      "2"
    );

    return { paging: response.paging, results: response.results || [] };
  }

  /**
   * Obtém detalhes da conta conectada via /users/me
   */
  static async fetchAccountDetails(accessToken: string): Promise<MeliUserPayload> {
    return this.request<MeliUserPayload>("/users/me", accessToken);
  }

  /**
   * Renova o access_token usando o refresh_token
   */
  static async refreshToken(refreshToken: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    user_id: number;
  }> {
    const clientId = process.env.MERCADO_LIVRE_CLIENT_ID;
    const clientSecret = process.env.MERCADO_LIVRE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("Credenciais do Mercado Livre não configuradas no .env");
    }

    const response = await fetch("https://api.mercadolibre.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }).toString(),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "sem detalhes");
      throw new Error(`Falha ao renovar token [${response.status}]: ${errText}`);
    }

    return response.json();
  }

  /**
   * Busca anúncios (Listings) em lotes (Chunks)
   */
  static async fetchListingsChunk(meliUserId: string, accessToken: string, scrollId?: string, limit: number = 50): Promise<{ items: MeliItemPayload[], scrollId?: string, total: number }> {
    interface SearchResult {
      results: string[];
      paging: { total: number };
      scroll_id?: string;
    }
    
    const allIds: string[] = [];
    let total = 0;
    let nextScrollId = scrollId;
    
    try {
      let url = `/users/${meliUserId}/items/search?search_type=scan&limit=${limit}`;
      if (scrollId) {
        url += `&scroll_id=${scrollId}`;
      }
      
      const searchRes = await this.request<SearchResult>(url, accessToken);
      if (searchRes.results && searchRes.results.length > 0) {
        allIds.push(...searchRes.results);
      }
      total = searchRes.paging?.total || 0;
      nextScrollId = searchRes.scroll_id || undefined;
    } catch (e) {
      console.warn(`Erro na busca de items (chunk):`, e);
    }

    if (allIds.length === 0) return { items: [], scrollId: nextScrollId, total };

    // Faz o multiget em lotes de 20
    const batches: string[][] = [];
    const idsToProcess = [...allIds];
    while (idsToProcess.length > 0) {
      batches.push(idsToProcess.splice(0, 20));
    }

    const items: MeliItemPayload[] = [];
    
    const chunkSize = 5;
    for (let i = 0; i < batches.length; i += chunkSize) {
      const chunk = batches.slice(i, i + chunkSize);
      const promises = chunk.map(batch => {
        const idsStr = batch.join(",");
        return this.request<any[]>(`/items?ids=${idsStr}`, accessToken).catch(() => []);
      });
      
      const chunkResults = await Promise.all(promises);
      chunkResults.forEach(batchRes => {
        if (Array.isArray(batchRes)) {
          batchRes.forEach(res => {
            if (res.code === 200 && res.body) items.push(res.body);
          });
        }
      });
    }

    return { items, scrollId: nextScrollId, total };
  }

  /**
   * Busca as vendas (Orders) em lotes (Chunks)
   */
  static async fetchOrdersChunk(meliUserId: string, accessToken: string, offset: number = 0, limit: number = 50): Promise<{ orders: MeliOrderPayload[], total: number }> {
    interface SearchResult {
      results: MeliOrderPayload[];
      paging: { total: number };
    }

    const allOrders: MeliOrderPayload[] = [];
    let total = 0;

    try {
      const searchRes = await this.request<SearchResult>(
        `/orders/search?seller=${meliUserId}&limit=${limit}&offset=${offset}`,
        accessToken
      );
      if (searchRes.results && searchRes.results.length > 0) {
        allOrders.push(...searchRes.results);
      }
      total = searchRes.paging?.total || 0;
    } catch (e) {
      console.warn(`Erro na busca de orders (chunk):`, e);
    }

    return { orders: allOrders, total };
  }

  /**
   * Busca uma venda específica pelo ID do Mercado Livre.
   */
  static async fetchOrder(orderId: string, accessToken: string): Promise<MeliOrderPayload> {
    return this.request<MeliOrderPayload>(`/orders/${orderId}`, accessToken);
  }

  /**
   * Busca um anúncio específico pelo ID do Mercado Livre.
   */
  static async fetchItem(itemId: string, accessToken: string): Promise<MeliItemPayload> {
    return this.request<MeliItemPayload>(`/items/${itemId}`, accessToken);
  }

  /**
   * Busca detalhes físicos de postagem/logística (Shipment)
   */
  static async fetchShipment(shipmentId: string, accessToken: string): Promise<MeliShipmentPayload> {
    return this.request<MeliShipmentPayload>(`/shipments/${shipmentId}`, accessToken);
  }

  /**
   * Busca perguntas (Questions) em lotes (Chunks)
   */
  static async fetchQuestionsChunk(meliUserId: string, accessToken: string, offset: number = 0, limit: number = 50): Promise<{ questions: MeliQuestionPayload[], total: number }> {
    interface SearchResult {
      questions: MeliQuestionPayload[];
      total: number;
    }

    try {
      const searchRes = await this.request<SearchResult>(
        `/questions/search?seller_id=${meliUserId}&limit=${limit}&offset=${offset}`,
        accessToken
      );
      return {
        questions: searchRes.questions || [],
        total: searchRes.total || 0
      };
    } catch (e) {
      console.warn(`Erro na busca de questions (chunk):`, e);
      return { questions: [], total: 0 };
    }
  }

  /**
   * Busca promoções ativas associadas ao catálogo
   */
  static async fetchPromotions(meliUserId: string, accessToken: string): Promise<MeliPromotionPayload[]> {
    interface SearchResult {
      results: MeliPromotionPayload[];
    }
    
    // Endpoint oficial do Meli para seller promotions
    try {
      const searchRes = await this.request<SearchResult>(
        `/seller-promotions/users/${meliUserId}?limit=50`,
        accessToken
      );
      return searchRes.results || [];
    } catch (err) {
      console.warn("Erro ao buscar promoções de seller promotions: ", err);
      // Se falhar ou não estiver disponível para a conta sandbox, retorna vazio
      return [];
    }
  }

  /**
   * Busca campanhas de Product Ads associadas ao vendedor (quando disponível)
   */
  static async fetchCampaigns(meliUserId: string, accessToken: string): Promise<MeliCampaignPayload[]> {
    interface SearchResult {
      results: MeliCampaignPayload[];
    }

    // Endpoint de product ads do Meli
    try {
      const searchRes = await this.request<SearchResult>(
        `/advertising/product-ads/campaigns/search?seller_id=${meliUserId}`,
        accessToken
      );
      return searchRes.results || [];
    } catch (err) {
      console.warn("Erro ao buscar campanhas de Ads: ", err);
      // Retorna vazio se a conta não estiver qualificada ou a API retornar indisponível
      return [];
    }
  }

  /**
   * Atualiza uma campanha de Product Ads (status, orçamento, objetivo/target_acos)
   */
  static async updateCampaign(
    campaignId: number,
    accessToken: string,
    payload: { status?: string; daily_budget?: number; target_acos?: number }
  ): Promise<any> {
    const url = `/advertising/product-ads/campaigns/${campaignId}`;
    try {
      return await this.request(url, accessToken, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    } catch (err: any) {
      console.error(`Erro ao atualizar campanha ${campaignId}:`, err);
      throw new Error(err.message || "Falha ao atualizar campanha no Mercado Livre.");
    }
  }

  /**
   * Busca métricas agregadas de Ads para uma campanha num período
   */
  static async fetchCampaignMetrics(
    campaignId: number,
    accessToken: string,
    dateFrom: string,
    dateTo: string
  ): Promise<any> {
    const url = `/advertising/product-ads/metrics/campaigns/${campaignId}?date_from=${dateFrom}&date_to=${dateTo}`;
    try {
      return await this.request(url, accessToken);
    } catch (err) {
      console.warn(`Erro ao buscar métricas da campanha ${campaignId}:`, err);
      // Retorna objeto zerado em caso de erro para não quebrar a tela
      return { clicks: 0, impressions: 0, cost: 0, sales_amount: 0, sales_quantity: 0, acos: 0 };
    }
  }

  /**
   * Busca a saúde (health/qualidade) de múltiplos anúncios.
   */
  static async fetchItemsHealth(itemIds: string[], accessToken: string): Promise<any[]> {
    if (itemIds.length === 0) return [];
    try {
      const idsStr = itemIds.join(",");
      const res = await this.request<any[]>(`/items/health?ids=${idsStr}`, accessToken);
      return res || [];
    } catch (err) {
      console.warn("Erro ao buscar saúde dos anúncios:", err);
      return [];
    }
  }

  /**
   * Atualiza status de um anúncio (ex: paused, active)
   */
  static async updateItemStatus(itemId: string, status: string, accessToken: string): Promise<any> {
    try {
      return await this.request(`/items/${itemId}`, accessToken, {
        method: "PUT",
        body: JSON.stringify({ status })
      });
    } catch (err: any) {
      throw new Error(`Erro ao atualizar status do anúncio ${itemId}: ${err.message}`);
    }
  }

  /**
   * Busca campanhas de promoção disponíveis para o seller (V2)
   */
  static async fetchSellerPromotionsV2(meliUserId: string, accessToken: string): Promise<any[]> {
    try {
      const res = await this.request<any>(
        `/seller-promotions/users/${meliUserId}?app_version=v2&limit=50`, 
        accessToken
      );
      return res.results || [];
    } catch (err) {
      console.warn("Erro ao buscar promotions V2:", err);
      return [];
    }
  }

  /**
   * Aplica um desconto a um item em uma promoção (V2)
   */
  static async applyPromotion(
    itemId: string, 
    promotionId: string, 
    promotionType: string, 
    data: { dealPrice?: number; discountPercent?: number; quantity?: number }, 
    accessToken: string
  ): Promise<any> {
    try {
      let body: any = {
        promotion_id: promotionId,
        promotion_type: promotionType
      };

      // Adequa o payload conforme o tipo da promoção do ML
      switch (promotionType) {
        case "DEAL":
        case "LIGHTNING":
        case "DOD":
          body.deal_price = data.dealPrice;
          break;
        case "VOLUME":
          body.discount_percent = data.discountPercent;
          body.quantity = data.quantity;
          break;
        case "PRICE_DISCOUNT":
          // O price_discount pode exigir 'price' ao invés de 'deal_price', dependendo da doc atualizada. 
          // Mas na v2 seller-promotions, geralmente é discount_percent ou price.
          if (data.discountPercent) body.discount_percent = data.discountPercent;
          if (data.dealPrice) body.price = data.dealPrice;
          break;
        case "MARKETPLACE_CAMPAIGN":
        case "SMART":
        case "PRICE_MATCHING":
        default:
          // Muitas vezes campanhas co-financiadas e smart só exigem aceitar (apenas enviar o id e type)
          break;
      }

      return await this.request(`/seller-promotions/items/${itemId}`, accessToken, {
        method: "POST",
        body: JSON.stringify(body)
      });
    } catch (err: any) {
      throw new Error(`Erro ao aplicar promoção no anúncio ${itemId}: ${err.message}`);
    }
  }

  /**
   * Remove um item de uma promoção (Sair da campanha)
   */
  static async deletePromotion(
    itemId: string, 
    promotionId: string, 
    promotionType: string, 
    accessToken: string
  ): Promise<any> {
    try {
      return await this.request(
        `/seller-promotions/items/${itemId}?promotion_id=${promotionId}&promotion_type=${promotionType}`, 
        accessToken, 
        { method: "DELETE" }
      );
    } catch (err: any) {
      throw new Error(`Erro ao remover anúncio ${itemId} da promoção: ${err.message}`);
    }
  }

}
