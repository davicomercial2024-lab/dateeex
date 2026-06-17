import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { pbAdmin } from "@/lib/pb";
import { MercadoLivreApiService } from "@/services/mercado-livre-api.service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("datex_session")?.value;
    if (!token) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const session = await verifyToken(token);
    if (!session) return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");

    let filter = `organization="${session.orgId}" && isActive=true && status="CONNECTED"`;
    if (accountId && accountId !== "all") {
      filter += ` && id="${accountId}"`;
    }

    const accounts = await pbAdmin.collection("mercado_livre_accounts").getFullList({
      filter,
    });

    if (accounts.length === 0) {
      return NextResponse.json({ success: true, listings: [] });
    }

    const oauthTokens = await pbAdmin.collection("oauth_tokens").getFullList({
      filter: accounts.map(a => `account="${a.id}"`).join(" || ")
    });
    const tokensByAccount = Object.fromEntries(oauthTokens.map((t: any) => [t.account, t]));

    let allListings: any[] = [];

    for (const account of accounts) {
      const tokenRecord = tokensByAccount[account.id];
      if (!tokenRecord) continue;
      
      const dbListings = await pbAdmin.collection("listings").getList(1, 100, {
        filter: `account="${account.id}"`,
        sort: "-created"
      });

      if (dbListings.items.length === 0) continue;

      const itemIds = dbListings.items.map(l => l.mlItemId);
      const healthData = await MercadoLivreApiService.fetchItemsHealth(itemIds, tokenRecord.accessToken);
      
      const healthMap = new Map();
      healthData.forEach(h => {
        healthMap.set(h.item_id, h);
      });

      for (const listing of dbListings.items) {
        const h = healthMap.get(listing.mlItemId);
        
        const priceNum = Number(listing.price);
        const tarifaMedia = priceNum * 0.15;
        const custoFixo = priceNum < 79 ? 6 : 0; 
        const youReceive = priceNum - tarifaMedia - custoFixo;

        allListings.push({
          id: listing.id,
          mlItemId: listing.mlItemId,
          title: listing.title,
          price: priceNum,
          currencyId: listing.currencyId || "BRL",
          availableQuantity: listing.availableQuantity,
          soldQuantity: listing.soldQuantity,
          status: listing.status,
          permalink: listing.permalink,
          thumbnail: listing.thumbnail,
          accountId: account.id,
          accountName: account.nicknameCustom || account.nickname,
          youReceive: Math.max(youReceive, 0),
          quality: h?.health ? h.health * 100 : 80,
          recommendations: h?.actions || [],
          visits7d: null,
          sales7d: null,
          condition: null,
          shipping: null,
        });
      }
    }

    return NextResponse.json({ success: true, listings: allListings });
  } catch (error: any) {
    console.error("Erro GET /api/listings/advanced:", error);
    return NextResponse.json({ error: "Erro interno ao carregar anúncios avançados." }, { status: 500 });
  }
}
