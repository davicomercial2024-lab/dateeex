import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { pbAdmin } from "@/lib/pb";
import { MercadoLivreApiService } from "@/services/mercado-livre-api.service";

type RawPromotion = Record<string, unknown>;

function toStringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function toNumberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toDateValue(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizePromotion(promotion: RawPromotion) {
  return {
    id: toStringValue(promotion.id),
    name:
      toStringValue(promotion.name) ||
      toStringValue(promotion.title) ||
      "Campanha sem nome",
    type: toStringValue(promotion.type, "DEAL").toUpperCase(),
    status: toStringValue(promotion.status, "unknown").toLowerCase(),
    startDate:
      toDateValue(promotion.start_date) ??
      toDateValue(promotion.startDate) ??
      new Date().toISOString(),
    endDate:
      toDateValue(promotion.finish_date) ??
      toDateValue(promotion.deadline_date) ??
      toDateValue(promotion.end_date) ??
      null,
    suggestedPrice:
      toNumberValue(promotion.suggested_price) ??
      toNumberValue(promotion.price) ??
      null,
    maxPrice:
      toNumberValue(promotion.max_price) ??
      toNumberValue(promotion.max_deal_price) ??
      null,
    minQuantity:
      toNumberValue(promotion.min_quantity) ??
      toNumberValue(promotion.minQuantity) ??
      null,
    fundingMode:
      toStringValue(promotion.funding_mode) ||
      toStringValue(promotion.offer_type) ||
      null,
  };
}

function buildCampaignStats(campaigns: ReturnType<typeof normalizePromotion>[]) {
  const live = campaigns.filter((campaign) => campaign.status === "active").length;
  const scheduled = campaigns.filter((campaign) =>
    ["scheduled", "pending"].includes(campaign.status)
  ).length;
  const volume = campaigns.filter((campaign) => campaign.type === "VOLUME").length;

  return { total: campaigns.length, live, scheduled, volume };
}

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("datex_session")?.value;

    if (!token) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const session = await verifyToken(token);

    if (!session) {
      return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId") || "all";

    let filter = `organization = "${session.orgId}" && isActive = true && status = "CONNECTED"`;
    if (accountId && accountId !== "all") {
      filter += ` && id = "${accountId}"`;
    }

    const pbAccounts = await pbAdmin.collection("mercado_livre_accounts").getFullList({
      filter,
      sort: "-isDefault,created",
    });

    const accountIds = pbAccounts.map(a => a.id);
    let tokens: any[] = [];
    let listings: any[] = [];
    if (accountIds.length > 0) {
      const accountsFilter = accountIds.map(id => `account = "${id}"`).join(" || ");
      tokens = await pbAdmin.collection("oauth_tokens").getFullList({ filter: accountsFilter });
      
      const listingsFilter = `(${accountsFilter}) && status = "active"`;
      listings = await pbAdmin.collection("listings").getFullList({
         filter: listingsFilter,
         sort: "-updated"
      });
    }

    const accounts = pbAccounts.map(acc => ({
      ...acc,
      token: tokens.find(t => t.account === acc.id) || null,
      listings: listings.filter(l => l.account === acc.id).slice(0, 250)
    }));

    if (accounts.length === 0) {
      return NextResponse.json({
        success: true,
        selectedAccountId: accountId,
        canManage: false,
        campaigns: [],
        items: [],
        summary: {
          accountCount: 0,
          activeListings: 0,
          connectedCampaigns: 0,
          localOffers: 0,
        },
        stats: { total: 0, live: 0, scheduled: 0, volume: 0 },
      });
    }

    let localOffers: any[] = [];
    if (accountIds.length > 0) {
      const offersFilter = accountIds.map(id => `account = "${id}"`).join(" || ");
      const pbOffers = await pbAdmin.collection("promotion_offers").getFullList({
        filter: offersFilter,
        expand: "promotion,listing"
      });
      localOffers = pbOffers.map(offer => ({
        ...offer,
        promotion: offer.expand?.promotion || null,
        listing: offer.expand?.listing || null,
        listingId: offer.listing
      }));
    }

    const offerByListingId = new Map<string, typeof localOffers[number][]>();
    for (const offer of localOffers) {
      const bucket = offerByListingId.get(offer.listingId) ?? [];
      bucket.push(offer);
      offerByListingId.set(offer.listingId, bucket);
    }

    const campaignsByAccount = await Promise.all(
      accounts.map(async (account) => {
        if (!account.token) {
          return { accountId: account.id, campaigns: [] as ReturnType<typeof normalizePromotion>[] };
        }

        const rawCampaigns = await MercadoLivreApiService.fetchSellerPromotionsV2(
          (account as any).meliUserId,
          account.token.accessToken
        );

        const campaigns = rawCampaigns
          .map((promotion) => normalizePromotion(promotion as RawPromotion))
          .filter((promotion) => promotion.id);

        return { accountId: account.id, campaigns };
      })
    );

    const normalizedCampaigns = campaignsByAccount.flatMap(({ accountId: currentAccountId, campaigns }) =>
      campaigns.map((campaign) => ({
        ...campaign,
        accountId: currentAccountId,
      }))
    );

    const items = accounts.flatMap((account) =>
      account.listings.map((listing) => {
        const offers = offerByListingId.get(listing.id) ?? [];
        const originalPrice = Number(listing.price);
        const activeOffer = offers.find((offer) => offer.status === "active") ?? offers[0] ?? null;

        return {
          itemId: listing.mlItemId,
          listingId: listing.id,
          title: listing.title,
          thumbnail: listing.thumbnail,
          permalink: listing.permalink,
          status: listing.status,
          originalPrice,
          stock: listing.availableQuantity,
          soldQuantity: listing.soldQuantity,
          accountId: account.id,
          accountLabel: (account as any).nicknameCustom || (account as any).nickname,
          currencyId: listing.currencyId,
          currentPromotion: activeOffer
            ? {
                id: activeOffer.promotion.mlPromotionId,
                name: activeOffer.promotion.name,
                type: activeOffer.promotion.type,
                status: activeOffer.status,
                promoPrice: Number(activeOffer.promoPrice),
                originalPrice: Number(activeOffer.originalPrice),
              }
            : null,
        };
      })
    );

    return NextResponse.json({
      success: true,
      selectedAccountId: accountId,
      canManage: accountId !== "all" && accounts.length === 1,
      campaigns: normalizedCampaigns,
      items,
      summary: {
        accountCount: accounts.length,
        activeListings: items.length,
        connectedCampaigns: normalizedCampaigns.length,
        localOffers: localOffers.length,
      },
      stats: buildCampaignStats(normalizedCampaigns),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro interno.";
    console.error("GET /api/promotions/campaigns error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
