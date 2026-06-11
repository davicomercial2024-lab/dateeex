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
   * Busca anúncios (Listings) associados ao usuário
   */
  static async fetchListings(meliUserId: string, accessToken: string): Promise<MeliItemPayload[]> {
    interface SearchResult {
      results: string[];
      paging: { total: number };
    }
    
    // 1. Busca TODOS os IDs dos anúncios com paginação
    const allIds: string[] = [];
    let offset = 0;
    const limit = 50;
    
    while (true) {
      try {
        const searchRes = await this.request<SearchResult>(
          `/users/${meliUserId}/items/search?limit=${limit}&offset=${offset}`,
          accessToken
        );
        if (!searchRes.results || searchRes.results.length === 0) break;
        allIds.push(...searchRes.results);
        offset += limit;
        if (offset >= (searchRes.paging?.total || 0)) break;
      } catch (e) {
        console.warn(`Erro na paginação de items (offset ${offset}):`, e);
        break; // Sai do loop mas preserva o que já buscou
      }
    }

    if (allIds.length === 0) return [];

    // 2. Faz o multiget em lotes de 20
    const batches: string[][] = [];
    const idsToProcess = [...allIds];
    while (idsToProcess.length > 0) {
      batches.push(idsToProcess.splice(0, 20));
    }

    const items: MeliItemPayload[] = [];
    
    // Processa lotes em paralelo, mas com um limite de concorrência simples (ex: 5 requests por vez)
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

    return items;
  }

  /**
   * Busca as vendas (Orders) associadas ao usuário
   */
  static async fetchOrders(meliUserId: string, accessToken: string): Promise<MeliOrderPayload[]> {
    interface SearchResult {
      results: MeliOrderPayload[];
      paging: { total: number };
    }

    const allOrders: MeliOrderPayload[] = [];
    let offset = 0;
    const limit = 50;

    while (true) {
      try {
        const searchRes = await this.request<SearchResult>(
          `/orders/search?seller=${meliUserId}&limit=${limit}&offset=${offset}`,
          accessToken
        );
        if (!searchRes.results || searchRes.results.length === 0) break;
        allOrders.push(...searchRes.results);
        offset += limit;
        if (offset >= (searchRes.paging?.total || 0)) break;
      } catch (e) {
        console.warn(`Erro na paginação de orders (offset ${offset}):`, e);
        break;
      }
    }

    return allOrders;
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
   * Busca perguntas (Questions) associadas aos anúncios do vendedor
   */
  static async fetchQuestions(meliUserId: string, accessToken: string): Promise<MeliQuestionPayload[]> {
    interface SearchResult {
      questions: MeliQuestionPayload[];
    }

    const searchRes = await this.request<SearchResult>(
      `/questions/search?seller_id=${meliUserId}&limit=50`,
      accessToken
    );

    return searchRes.questions || [];
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

}
