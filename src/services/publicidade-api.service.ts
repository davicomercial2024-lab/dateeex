type RequestOptions = RequestInit;

type ProductId = "PADS" | "DISPLAY" | "BADS";

function buildQuery(params: Record<string, string | number | boolean | undefined | null>) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    searchParams.set(key, String(value));
  }

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export interface AdvertisingAdvertiser {
  advertiser_id: number;
  site_id: string;
  advertiser_name: string;
  account_name: string;
}

export interface ProductAdsCampaign {
  id: number;
  name: string;
  status: string;
  budget?: number;
  currency_id?: string;
  strategy?: string;
  channel?: string;
  roas_target?: number;
  acos_target?: number;
  automatic_budget?: boolean;
  last_updated?: string;
  date_created?: string;
  metrics?: Record<string, number>;
  metrics_summary?: Record<string, number>;
}

export interface ProductAdsItem {
  id: string;
  item_id?: string;
  title?: string;
  status?: string;
  campaign_id?: number;
  campaign_name?: string;
  price?: number;
  currency_id?: string;
  thumbnail?: string;
  permalink?: string;
  recommended?: boolean;
  buy_box_winner?: boolean;
  channel?: string;
  metrics?: Record<string, number>;
  metrics_summary?: Record<string, number>;
}

export interface BrandAdsCampaign {
  campaign_id: number;
  name: string;
  start_date?: string;
  end_date?: string | null;
  advertiser_id?: number;
  campaign_type?: string;
  status?: string;
  site_id?: string;
  official_store_id?: number;
  destination_id?: number;
  headline?: string;
  budget?: { amount?: number; currency?: string } | number;
  cpc?: number;
  items?: Array<{ campaign_id: number; status?: string; item_id: string }>;
  keywords?: Array<{
    campaign_id: number;
    keyword_id?: number;
    type: string;
    term: string;
    match_type?: string;
    is_negative?: boolean;
    cpc?: number;
  }>;
  metrics?: Record<string, any>;
}

export interface DisplayCampaign {
  id: number;
  name: string;
  start_date?: string;
  end_date?: string | null;
  advertiser_id?: number;
  type?: string;
  status?: string;
  site_id?: string;
  goal?: string;
}

export interface DisplayLineItem {
  line_item_id: number;
  name: string;
  start_date?: string;
  end_date?: string | null;
  campaign_id?: number;
  type?: string;
  status?: string;
}

export interface DisplayCreative {
  creative_id?: number;
  id?: number;
  name?: string;
  status?: string;
  type?: string;
  url?: string;
  metrics?: Record<string, any>;
}

export interface Bonification {
  status: string;
  creation_date?: string;
  end_date?: string;
  campaign_name?: string;
  currency_id?: string;
  level?: string;
  amount?: number;
  balance?: number;
  days_remaining?: number;
  campaign_id?: number;
  campaign_status?: string;
  benefit_name?: string;
}

export class PublicidadeApiService {
  private static BASE_URL = "https://api.mercadolibre.com";

  private static async request<T>(endpoint: string, accessToken: string, options: RequestOptions = {}): Promise<T> {
    const response = await fetch(`${this.BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });

    if (!response.ok) {
      const details = await response.text().catch(() => "");
      throw new Error(`Mercado Livre API [${response.status}]: ${details || response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  private static async advertisingRequest<T>(
    endpoint: string,
    accessToken: string,
    apiVersion: "1" | "2",
    options: RequestOptions = {}
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

  static async fetchAdvertisingAdvertisers(accessToken: string, productId: ProductId): Promise<AdvertisingAdvertiser[]> {
    const response = await this.advertisingRequest<{ advertisers?: AdvertisingAdvertiser[] }>(
      `/advertising/advertisers${buildQuery({ product_id: productId })}`,
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
    metricsSummary?: boolean;
  }): Promise<{ paging?: { total: number; offset: number; limit: number }; results: ProductAdsCampaign[] }> {
    const query = buildQuery({
      limit: params.limit ?? 50,
      offset: params.offset ?? 0,
      date_from: params.dateFrom,
      date_to: params.dateTo,
      metrics:
        "clicks,prints,ctr,cost,cpc,acos,organic_units_quantity,organic_units_amount,organic_items_quantity,direct_items_quantity,indirect_items_quantity,advertising_items_quantity,cvr,roas,sov,direct_units_quantity,indirect_units_quantity,units_quantity,direct_amount,indirect_amount,total_amount,impression_share,top_impression_share,lost_impression_share_by_budget,lost_impression_share_by_ad_rank,acos_benchmark",
      status: params.status && params.status !== "all" ? params.status : undefined,
      metrics_summary: params.metricsSummary ? true : undefined,
    });

    return this.advertisingRequest<{
      paging?: { total: number; offset: number; limit: number };
      results?: ProductAdsCampaign[];
    }>(
      `/advertising/${params.advertiserSiteId}/advertisers/${params.advertiserId}/product_ads/campaigns/search${query}`,
      params.accessToken,
      "2"
    ).then((response) => ({
      paging: response.paging,
      results: response.results || [],
    }));
  }

  static async fetchProductAdsCampaignDetail(params: {
    accessToken: string;
    advertiserSiteId: string;
    campaignId: number;
    dateFrom: string;
    dateTo: string;
  }): Promise<any> {
    const query = buildQuery({
      date_from: params.dateFrom,
      date_to: params.dateTo,
      metrics:
        "clicks,prints,ctr,cost,cpc,acos,organic_units_quantity,organic_units_amount,organic_items_quantity,direct_items_quantity,indirect_items_quantity,advertising_items_quantity,cvr,roas,sov,direct_units_quantity,indirect_units_quantity,units_quantity,direct_amount,indirect_amount,total_amount,impression_share,top_impression_share,lost_impression_share_by_budget,lost_impression_share_by_ad_rank,acos_benchmark",
      aggregation_type: "DAILY",
    });

    return this.advertisingRequest<any>(
      `/advertising/${params.advertiserSiteId}/product_ads/campaigns/${params.campaignId}${query}`,
      params.accessToken,
      "2"
    );
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
  }): Promise<{ paging?: { total: number; offset: number; limit: number }; results: ProductAdsItem[] }> {
    const query = buildQuery({
      limit: params.limit ?? 50,
      offset: params.offset ?? 0,
      date_from: params.dateFrom,
      date_to: params.dateTo,
      metrics:
        "clicks,prints,ctr,cost,cpc,acos,organic_units_quantity,organic_units_amount,organic_items_quantity,direct_items_quantity,indirect_items_quantity,advertising_items_quantity,cvr,roas,sov,direct_units_quantity,indirect_units_quantity,units_quantity,direct_amount,indirect_amount,total_amount,impression_share,top_impression_share,lost_impression_share_by_budget,lost_impression_share_by_ad_rank,acos_benchmark",
      status: params.status && params.status !== "all" ? params.status : undefined,
      campaign_id: params.campaignId && params.campaignId !== "all" ? params.campaignId : undefined,
      recommended: params.recommendedOnly ? true : undefined,
    });

    return this.advertisingRequest<{
      paging?: { total: number; offset: number; limit: number };
      results?: ProductAdsItem[];
    }>(
      `/advertising/${params.advertiserSiteId}/advertisers/${params.advertiserId}/product_ads/ads/search${query}`,
      params.accessToken,
      "2"
    ).then((response) => ({
      paging: response.paging,
      results: response.results || [],
    }));
  }

  static async fetchProductAdDetail(params: {
    accessToken: string;
    advertiserSiteId: string;
    itemId: string;
    dateFrom: string;
    dateTo: string;
  }): Promise<any> {
    const query = buildQuery({
      date_from: params.dateFrom,
      date_to: params.dateTo,
      metrics:
        "clicks,prints,ctr,cost,cpc,acos,organic_units_quantity,organic_units_amount,organic_items_quantity,direct_items_quantity,indirect_items_quantity,advertising_items_quantity,cvr,roas,sov,direct_units_quantity,indirect_units_quantity,units_quantity,direct_amount,indirect_amount,total_amount",
      aggregation_type: "item",
    });

    return this.advertisingRequest<any>(
      `/advertising/${params.advertiserSiteId}/product_ads/ads/${params.itemId}${query}`,
      params.accessToken,
      "2"
    );
  }

  static async fetchBrandAdsCampaigns(params: {
    accessToken: string;
    advertiserId: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  }): Promise<{ results: BrandAdsCampaign[] }> {
    return this.advertisingRequest<{ results?: BrandAdsCampaign[] }>(
      `/advertising/advertisers/${params.advertiserId}/brand_ads/campaigns${buildQuery({
        sort_by: params.sortBy ?? "start_date",
        sort_order: params.sortOrder ?? "desc",
      })}`,
      params.accessToken,
      "1"
    ).then((response) => ({
      results: response.results || [],
    }));
  }

  static async fetchBrandAdsCampaignDetail(params: {
    accessToken: string;
    advertiserId: number;
    campaignId: number;
  }): Promise<any> {
    return this.advertisingRequest<any>(
      `/advertising/advertisers/${params.advertiserId}/brand_ads/campaigns/${params.campaignId}`,
      params.accessToken,
      "1"
    );
  }

  static async fetchBrandAdsCampaignMetrics(params: {
    accessToken: string;
    advertiserId: number;
    campaignId: number;
    dateFrom: string;
    dateTo: string;
  }): Promise<any> {
    return this.advertisingRequest<any>(
      `/advertising/advertisers/${params.advertiserId}/brand_ads/campaigns/${params.campaignId}/metrics${buildQuery({
        date_from: params.dateFrom,
        date_to: params.dateTo,
      })}`,
      params.accessToken,
      "1"
    );
  }

  static async fetchBrandAdsCampaignItems(params: {
    accessToken: string;
    advertiserId: number;
    campaignId: number;
  }): Promise<any[]> {
    const response = await this.advertisingRequest<{ results?: any[] }>(
      `/advertising/advertisers/${params.advertiserId}/brand_ads/campaigns/${params.campaignId}/items`,
      params.accessToken,
      "1"
    );
    return (response.results ?? []) as any[];
  }

  static async fetchBrandAdsCampaignKeywords(params: {
    accessToken: string;
    advertiserId: number;
    campaignId: number;
  }): Promise<any[]> {
    const response = await this.advertisingRequest<{ results?: any[] }>(
      `/advertising/advertisers/${params.advertiserId}/brand_ads/campaigns/${params.campaignId}/keywords`,
      params.accessToken,
      "1"
    );
    return (response.results ?? []) as any[];
  }

  static async fetchBrandAdsKeywordsMetrics(params: {
    accessToken: string;
    advertiserId: number;
    campaignId: number;
    dateFrom: string;
    dateTo: string;
  }): Promise<any> {
    return this.advertisingRequest<any>(
      `/advertising/advertisers/${params.advertiserId}/brand_ads/campaigns/${params.campaignId}/keywords/metrics${buildQuery({
        date_from: params.dateFrom,
        date_to: params.dateTo,
      })}`,
      params.accessToken,
      "1"
    );
  }

  static async fetchDisplayCampaigns(params: {
    accessToken: string;
    advertiserId: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  }): Promise<{ results: DisplayCampaign[] }> {
    return this.advertisingRequest<{ results?: DisplayCampaign[] }>(
      `/advertising/advertisers/${params.advertiserId}/display/campaigns${buildQuery({
        sort_by: params.sortBy ?? "start_date",
        sort_order: params.sortOrder ?? "desc",
      })}`,
      params.accessToken,
      "1"
    ).then((response) => ({
      results: response.results || [],
    }));
  }

  static async fetchDisplayCampaignMetrics(params: {
    accessToken: string;
    advertiserId: number;
    campaignId: number;
    dateFrom: string;
    dateTo: string;
  }): Promise<any> {
    return this.advertisingRequest<any>(
      `/advertising/advertisers/${params.advertiserId}/display/campaigns/${params.campaignId}/metrics${buildQuery({
        date_from: params.dateFrom,
        date_to: params.dateTo,
      })}`,
      params.accessToken,
      "1"
    );
  }

  static async fetchDisplayLineItems(params: {
    accessToken: string;
    advertiserId: number;
    campaignId: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  }): Promise<{ results: DisplayLineItem[] }> {
    return this.advertisingRequest<{ results?: DisplayLineItem[] }>(
      `/advertising/advertisers/${params.advertiserId}/display/campaigns/${params.campaignId}/line_items${buildQuery({
        sort_by: params.sortBy ?? "start_date",
        sort_order: params.sortOrder ?? "desc",
      })}`,
      params.accessToken,
      "1"
    ).then((response) => ({
      results: response.results || [],
    }));
  }

  static async fetchDisplayLineItemCreatives(params: {
    accessToken: string;
    advertiserId: number;
    campaignId: number;
    lineItemId: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  }): Promise<{ results: DisplayCreative[] }> {
    return this.advertisingRequest<{ results?: DisplayCreative[] }>(
      `/advertising/advertisers/${params.advertiserId}/display/campaigns/${params.campaignId}/line_items/${params.lineItemId}/creatives${buildQuery({
        sort_by: params.sortBy ?? "name",
        sort_order: params.sortOrder ?? "asc",
      })}`,
      params.accessToken,
      "1"
    ).then((response) => ({
      results: response.results || [],
    }));
  }

  static async fetchDisplayMetrics(params: {
    accessToken: string;
    advertiserId: number;
    dateFrom: string;
    dateTo: string;
    dimension: "line_items" | "creatives";
    campaignId?: number;
    ids?: Array<number | string>;
    lineItemId?: number;
  }): Promise<any[]> {
    const query = buildQuery({
      dimension: params.dimension,
      date_from: params.dateFrom,
      date_to: params.dateTo,
      campaign_id: params.campaignId,
      ids: params.ids?.length ? params.ids.join(",") : undefined,
      line_item_id: params.lineItemId,
    });

    return this.advertisingRequest<any[]>(
      `/advertising/advertisers/${params.advertiserId}/display/metrics${query}`,
      params.accessToken,
      "1"
    );
  }

  static async fetchBonifications(accessToken: string): Promise<Bonification[]> {
    const response = await this.advertisingRequest<{ bonification?: Bonification[] }>(
      "/advertising/advertisers/bonifications",
      accessToken,
      "1"
    );

    return response.bonification || [];
  }
}
