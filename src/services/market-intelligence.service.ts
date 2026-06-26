type SearchParamsValue = string | number | boolean | undefined | null;

export interface MarketplaceSearchParams {
  query: string;
  categoryId?: string;
  limit?: number;
  offset?: number;
  sort?: string;
}

export interface PriceRule {
  competitorItemIds: string[];
  minPrice?: number;
  maxPrice?: number;
  discountPercent?: number;
  roundTo?: number;
}

const BASE_URL = "https://api.mercadolibre.com";

function buildQuery(params: Record<string, SearchParamsValue>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  });
  const query = search.toString();
  return query ? `?${query}` : "";
}

async function request<T>(endpoint: string, accessToken?: string): Promise<T> {
  const headers: HeadersInit = {
    Accept: "application/json",
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    headers,
    signal: AbortSignal.timeout(25000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "sem detalhes");
    throw new Error(`Mercado Livre API [${response.status}]: ${text}`);
  }

  return response.json() as Promise<T>;
}

export class MarketIntelligenceService {
  static parseItemId(input: string) {
    const trimmed = input.trim().toUpperCase();
    const match = trimmed.match(/MLB-?\d+/);
    return match ? match[0].replace("-", "") : trimmed;
  }

  static async searchMarketplace(params: MarketplaceSearchParams) {
    const limit = Math.min(Math.max(params.limit ?? 30, 1), 50);
    const endpoint = `/sites/MLB/search${buildQuery({
      q: params.query,
      category: params.categoryId,
      limit,
      offset: params.offset ?? 0,
      sort: params.sort,
    })}`;

    const data = await request<any>(endpoint);
    const results = Array.isArray(data.results) ? data.results : [];

    return {
      query: params.query,
      categoryId: params.categoryId || null,
      paging: data.paging || null,
      filters: data.filters || [],
      availableFilters: data.available_filters || [],
      results: results.map((item: any, index: number) => ({
        rank: (params.offset ?? 0) + index + 1,
        itemId: item.id,
        title: item.title,
        price: item.price,
        currencyId: item.currency_id,
        sellerId: item.seller?.id || item.seller_id || null,
        permalink: item.permalink,
        thumbnail: item.thumbnail,
        soldQuantity: item.sold_quantity ?? null,
        availableQuantity: item.available_quantity ?? null,
        catalogProductId: item.catalog_product_id || null,
        listingTypeId: item.listing_type_id || null,
        condition: item.condition || null,
      })),
    };
  }

  static async fetchItemAnalysis(input: string, accessToken?: string) {
    const itemId = this.parseItemId(input);
    const item = await request<any>(`/items/${itemId}`, accessToken);
    const description = await request<any>(`/items/${itemId}/description`, accessToken).catch(() => null);
    const priceToWin = await request<any>(`/items/${itemId}/price_to_win`, accessToken).catch(() => null);

    return {
      itemId: item.id,
      title: item.title,
      status: item.status,
      price: item.price,
      basePrice: item.base_price,
      originalPrice: item.original_price,
      currencyId: item.currency_id,
      sellerId: item.seller_id,
      categoryId: item.category_id,
      catalogProductId: item.catalog_product_id || null,
      catalogListing: item.catalog_listing ?? null,
      listingTypeId: item.listing_type_id,
      condition: item.condition,
      availableQuantity: item.available_quantity,
      soldQuantity: item.sold_quantity,
      health: item.health ?? null,
      pictures: item.pictures || [],
      attributes: item.attributes || [],
      permalink: item.permalink,
      thumbnail: item.thumbnail,
      descriptionText: description?.plain_text || "",
      priceToWin,
    };
  }

  static async analyzeCompetitor(input: string, accessToken?: string) {
    const item = await this.fetchItemAnalysis(input, accessToken);
    const seller = await request<any>(`/users/${item.sellerId}`, accessToken).catch(() => null);
    const sellerListings = await request<any>(`/sites/MLB/search${buildQuery({
      seller_id: item.sellerId,
      limit: 50,
    })}`, accessToken).catch(() => ({ results: [] }));

    const listings = Array.isArray(sellerListings.results) ? sellerListings.results : [];
    const prices = listings.map((listing: any) => Number(listing.price)).filter((price: number) => Number.isFinite(price));

    return {
      item,
      seller: seller
        ? {
            id: seller.id,
            nickname: seller.nickname,
            siteId: seller.site_id,
            reputation: seller.seller_reputation || null,
            points: seller.points ?? null,
            registrationDate: seller.registration_date || null,
            permalink: seller.permalink || null,
          }
        : null,
      sellerPortfolio: {
        sampledListings: listings.length,
        minPrice: prices.length ? Math.min(...prices) : null,
        maxPrice: prices.length ? Math.max(...prices) : null,
        averagePrice: prices.length ? prices.reduce((sum: number, price: number) => sum + price, 0) / prices.length : null,
        activeCatalogListings: listings.filter((listing: any) => listing.catalog_product_id).length,
        listings: listings.slice(0, 20).map((listing: any) => ({
          itemId: listing.id,
          title: listing.title,
          price: listing.price,
          permalink: listing.permalink,
          thumbnail: listing.thumbnail,
          soldQuantity: listing.sold_quantity ?? null,
          catalogProductId: listing.catalog_product_id || null,
        })),
      },
    };
  }

  static async findItemRank(params: { itemId: string; query: string; categoryId?: string; maxPages?: number }) {
    const target = this.parseItemId(params.itemId);
    const maxPages = Math.min(Math.max(params.maxPages ?? 10, 1), 20);
    const limit = 50;

    for (let page = 0; page < maxPages; page += 1) {
      const search = await this.searchMarketplace({
        query: params.query,
        categoryId: params.categoryId,
        limit,
        offset: page * limit,
      });

      const found = search.results.find((result: any) => result.itemId === target);
      if (found) {
        return {
          found: true,
          rank: found.rank,
          item: found,
          searchedUntil: (page + 1) * limit,
        };
      }
    }

    return {
      found: false,
      rank: null,
      item: null,
      searchedUntil: maxPages * limit,
    };
  }

  static async priceRecommendation(rule: PriceRule, accessToken?: string) {
    const competitors = await Promise.all(
      rule.competitorItemIds
        .map((id) => this.parseItemId(id))
        .filter(Boolean)
        .map((id) => this.fetchItemAnalysis(id, accessToken).catch((error) => ({ itemId: id, error: error.message })))
    );

    const validPrices = competitors
      .map((item: any) => Number(item.price))
      .filter((price) => Number.isFinite(price) && price > 0);

    if (validPrices.length === 0) {
      return { competitors, recommendation: null, reason: "Nenhum concorrente valido com preco encontrado." };
    }

    const referencePrice = Math.min(...validPrices);
    const discount = Math.max(rule.discountPercent ?? 0, 0);
    let suggested = referencePrice * (1 - discount / 100);

    if (Number.isFinite(rule.minPrice)) suggested = Math.max(suggested, Number(rule.minPrice));
    if (Number.isFinite(rule.maxPrice)) suggested = Math.min(suggested, Number(rule.maxPrice));
    if (rule.roundTo && rule.roundTo > 0) suggested = Math.floor(suggested / rule.roundTo) * rule.roundTo;

    return {
      competitors,
      recommendation: {
        referencePrice,
        suggestedPrice: Number(suggested.toFixed(2)),
        minCompetitorPrice: Math.min(...validPrices),
        maxCompetitorPrice: Math.max(...validPrices),
        averageCompetitorPrice: Number((validPrices.reduce((sum, price) => sum + price, 0) / validPrices.length).toFixed(2)),
        discountPercent: discount,
      },
    };
  }
}
