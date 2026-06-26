import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { pbAdmin } from "@/lib/pb";
import { MercadoLivreSyncService } from "@/services/mercado-livre-sync.service";
import { MarketIntelligenceService } from "@/services/market-intelligence.service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get("datex_session")?.value;
  if (!token) return null;
  return verifyToken(token);
}

async function getAccessToken(accountId: string | undefined, orgId: string) {
  if (!accountId || accountId === "all") return undefined;
  const { token } = await MercadoLivreSyncService.getAccountAndToken(accountId, orgId);
  return token.accessToken as string;
}

async function catalogOverview(accountId: string | undefined, orgId: string) {
  await pbAdmin.admins.authWithPassword(
    process.env.PB_ADMIN_EMAIL as string,
    process.env.PB_ADMIN_PASS as string
  );

  let filter = `organization="${orgId}"`;
  if (accountId && accountId !== "all") {
    filter += ` && account="${accountId}"`;
  }

  const listings = await pbAdmin.collection("listings").getFullList({
    filter,
    sort: "-updated",
    fields: "id,account,mlItemId,title,price,status,thumbnail,permalink,catalogProductId,availableQuantity,soldQuantity",
    requestKey: null,
  });

  const linked = listings.filter((listing) => Boolean(listing.catalogProductId));
  const pending = listings.filter((listing) => !listing.catalogProductId);
  const byCatalog = new Map<string, any[]>();

  for (const listing of linked) {
    const key = String(listing.catalogProductId);
    const bucket = byCatalog.get(key) || [];
    bucket.push(listing);
    byCatalog.set(key, bucket);
  }

  const contestedCatalogs = Array.from(byCatalog.entries())
    .filter(([, items]) => items.length > 1)
    .map(([catalogProductId, items]) => ({
      catalogProductId,
      items: items.slice(0, 10),
      count: items.length,
      bestLocalPrice: Math.min(...items.map((item) => Number(item.price)).filter(Number.isFinite)),
    }))
    .slice(0, 50);

  return {
    summary: {
      total: listings.length,
      linked: linked.length,
      pending: pending.length,
      contestedCatalogs: contestedCatalogs.length,
    },
    linked: linked.slice(0, 100),
    pending: pending.slice(0, 100),
    contestedCatalogs,
  };
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Sessao invalida." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const action = body.action as string;
    const accountId = body.accountId as string | undefined;
    const accessToken = await getAccessToken(accountId, session.orgId);

    if (action === "keyword_search") {
      const query = String(body.query || "").trim();
      if (!query) return NextResponse.json({ error: "Informe uma palavra-chave." }, { status: 400 });
      const result = await MarketIntelligenceService.searchMarketplace({
        query,
        categoryId: body.categoryId,
        limit: Number(body.limit || 30),
        sort: body.sort,
      });
      return NextResponse.json({ success: true, result });
    }

    if (action === "listing_analysis") {
      const input = String(body.input || "").trim();
      if (!input) return NextResponse.json({ error: "Informe um link ou MLB." }, { status: 400 });
      const result = await MarketIntelligenceService.fetchItemAnalysis(input, accessToken);
      return NextResponse.json({ success: true, result });
    }

    if (action === "competitor_analysis") {
      const input = String(body.input || "").trim();
      if (!input) return NextResponse.json({ error: "Informe um link ou MLB do concorrente." }, { status: 400 });
      const result = await MarketIntelligenceService.analyzeCompetitor(input, accessToken);
      return NextResponse.json({ success: true, result });
    }

    if (action === "rank_analysis") {
      const itemId = String(body.itemId || "").trim();
      const query = String(body.query || "").trim();
      if (!itemId || !query) {
        return NextResponse.json({ error: "Informe MLB e palavra-chave." }, { status: 400 });
      }
      const result = await MarketIntelligenceService.findItemRank({
        itemId,
        query,
        categoryId: body.categoryId,
        maxPages: Number(body.maxPages || 10),
      });
      return NextResponse.json({ success: true, result });
    }

    if (action === "auto_pricer") {
      const result = await MarketIntelligenceService.priceRecommendation({
        competitorItemIds: Array.isArray(body.competitorItemIds) ? body.competitorItemIds : [],
        minPrice: body.minPrice ? Number(body.minPrice) : undefined,
        maxPrice: body.maxPrice ? Number(body.maxPrice) : undefined,
        discountPercent: body.discountPercent ? Number(body.discountPercent) : undefined,
        roundTo: body.roundTo ? Number(body.roundTo) : undefined,
      }, accessToken);
      return NextResponse.json({ success: true, result });
    }

    if (action === "catalog_overview") {
      const result = await catalogOverview(accountId, session.orgId);
      return NextResponse.json({ success: true, result });
    }

    return NextResponse.json({ error: "Acao invalida." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno.";
    console.error("POST /api/market-intelligence error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
