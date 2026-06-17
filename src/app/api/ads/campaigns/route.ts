import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { pbAdmin } from "@/lib/pb";
import { MercadoLivreApiService } from "@/services/mercado-livre-api.service";

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("datex_session")?.value;
    if (!token) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const session = await verifyToken(token);
    if (!session) return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");
    const dateFrom = searchParams.get("dateFrom") || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const dateTo = searchParams.get("dateTo") || new Date().toISOString().split('T')[0];

    // Busca a conta e o token
    let filter = `organization = "${session.orgId}" && isActive = true && status = "CONNECTED"`;
    if (accountId && accountId !== "all") {
      filter += ` && id = "${accountId}"`;
    }

    const pbAccounts = await pbAdmin.collection("mercado_livre_accounts").getFullList({
      filter,
    });

    const accountIds = pbAccounts.map(a => a.id);
    let tokens: any[] = [];
    if (accountIds.length > 0) {
      const tokensFilter = accountIds.map(id => `account = "${id}"`).join(" || ");
      tokens = await pbAdmin.collection("oauth_tokens").getFullList({ filter: tokensFilter });
    }

    const accounts = pbAccounts.map(acc => ({
      ...acc,
      token: tokens.find(t => t.account === acc.id) || null
    }));

    if (accounts.length === 0) {
      return NextResponse.json({ success: true, campaigns: [], summary: {} });
    }

    let allCampaigns: any[] = [];
    let summary = {
      salesAmountAds: 0,
      salesAmountTotal: 0, // Mock: ML API doesn't return non-ads sales in the same endpoint
      cost: 0,
      clicks: 0,
      roas: 0,
      acos: 0,
    };

    for (const account of accounts) {
      if (!account.token) continue;
      const accessToken = account.token.accessToken;
      const meliUserId = (account as any).meliUserId;

      const campaigns = await MercadoLivreApiService.fetchCampaigns(meliUserId, accessToken);

      for (const camp of campaigns) {
        // Fetch metrics for each campaign
        const metrics = await MercadoLivreApiService.fetchCampaignMetrics(camp.id, accessToken, dateFrom, dateTo);

        // Normalize metrics
        const campClicks = metrics?.clicks || 0;
        const campCost = metrics?.cost || 0;
        const campSales = metrics?.sales_amount || 0;
        const campRoas = campCost > 0 ? campSales / campCost : 0;
        const campAcos = campSales > 0 ? (campCost / campSales) * 100 : 0;

        summary.clicks += campClicks;
        summary.cost += campCost;
        summary.salesAmountAds += campSales;

        allCampaigns.push({
          id: camp.id,
          name: camp.name,
          status: camp.status, // active, paused
          budget: camp.daily_budget,
          accountId: account.id,
          accountName: (account as any).nicknameCustom || (account as any).nickname,
          metrics: {
            clicks: campClicks,
            cost: campCost,
            sales: campSales,
            roas: campRoas,
            acos: campAcos,
          }
        });
      }
    }

    // Calcular ROAS e ACOS globais
    summary.roas = summary.cost > 0 ? summary.salesAmountAds / summary.cost : 0;
    summary.acos = summary.salesAmountAds > 0 ? (summary.cost / summary.salesAmountAds) * 100 : 0;

    return NextResponse.json({
      success: true,
      summary,
      campaigns: allCampaigns,
    });
  } catch (error: any) {
    console.error("Erro GET /api/ads/campaigns:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
