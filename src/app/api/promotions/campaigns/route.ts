import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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

    const accounts = await prisma.mercadoLivreAccount.findMany({
      where: {
        organizationId: session.orgId,
        isActive: true,
        status: "CONNECTED",
        ...(accountId !== "all" ? { id: accountId } : {}),
      },
      include: {
        token: true,
        listings: {
          where: { status: "active" },
          orderBy: { updatedAt: "desc" },
          take: 250,
        },
      },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });

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

    const localOffers = await prisma.promotionOffer.findMany({
      where: {
        mercadoLivreAccountId: { in: accounts.map((account) => account.id) },
      },
      include: {
        promotion: true,
        listing: true,
      },
    });

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
          account.meliUserId,
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
          accountLabel: account.nicknameCustom || account.nickname,
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
