import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { pbAdmin } from "@/lib/pb";
import { verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PERIOD_DAYS: Record<string, number> = {
  "1": 1,
  "7": 7,
  "30": 30,
  "60": 60,
};

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function parseLocalDate(value: string | null) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("datex_session");

    if (!sessionCookie) {
      return NextResponse.json({ error: "Sessão não encontrada." }, { status: 401 });
    }

    const payload = await verifyToken(sessionCookie.value);
    if (!payload) {
      return NextResponse.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
    }

    await pbAdmin.admins.authWithPassword(process.env.PB_ADMIN_EMAIL as string, process.env.PB_ADMIN_PASS as string);

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId") || "all";
    const period = searchParams.get("period") || "30";
    const customDate = parseLocalDate(searchParams.get("date"));

    const orgId = payload.orgId;

    if (accountId !== "all") {
      const account = await pbAdmin.collection("mercado_livre_accounts").getOne(accountId).catch(() => null);
      if (!account || account.organization !== orgId) {
        return NextResponse.json(
          { error: "Conta não encontrada ou acesso negado." },
          { status: 403 }
        );
      }
    }

    const today = startOfDay(new Date());
    const rangeEnd = period === "custom" && customDate ? endOfDay(customDate) : endOfDay(today);
    const rangeStart =
      period === "custom" && customDate
        ? startOfDay(customDate)
        : startOfDay(new Date(today.getTime() - ((PERIOD_DAYS[period] ?? 30) - 1) * 24 * 60 * 60 * 1000));
    const rangeDays =
      Math.floor((startOfDay(rangeEnd).getTime() - rangeStart.getTime()) / (24 * 60 * 60 * 1000)) + 1;

    const baseParams = { orgId, acc: accountId };
    const accFilter = accountId !== "all" ? " && account = {:acc}" : "";

    const activeListingsP = pbAdmin.collection("listings").getList(1, 1, { requestKey: null, filter: pbAdmin.filter(`organization = {:orgId} && status = 'active'` + accFilter, baseParams) }).catch((e) => { console.error("Err listings:", e); return { totalItems: 0 }; });
    const pausedListingsP = pbAdmin.collection("listings").getList(1, 1, { requestKey: null, filter: pbAdmin.filter(`organization = {:orgId} && status = 'paused'` + accFilter, baseParams) }).catch((e) => { console.error("Err paused:", e); return { totalItems: 0 }; });
    const pendingQuestionsP = pbAdmin.collection("questions").getList(1, 1, { requestKey: null, filter: pbAdmin.filter(`organization = {:orgId} && status = 'unanswered'` + accFilter, baseParams) }).catch((e) => { console.error("Err questions:", e); return { totalItems: 0 }; });
    const activeClaimsP = pbAdmin.collection("claims").getList(1, 1, { requestKey: null, filter: pbAdmin.filter(`organization = {:orgId} && stage != 'closed'` + accFilter, baseParams) }).catch((e) => { console.error("Err claims:", e); return { totalItems: 0 }; });
    
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().replace("T", " ");
    const lateShipmentsP = pbAdmin.collection("shipments").getList(1, 1, { 
      requestKey: null, filter: pbAdmin.filter(`organization = {:orgId} && (status = 'ready_to_ship' || status = 'handling') && created < {:twoDaysAgo}` + accFilter, { ...baseParams, twoDaysAgo }) 
    }).catch((e) => { console.error("Err shipments:", e); return { totalItems: 0 }; });

    const activePromotionsP = pbAdmin.collection("promotions").getList(1, 1, { requestKey: null, filter: pbAdmin.filter(`organization = {:orgId} && status = 'active'`, baseParams) }).catch((e) => { console.error("Err promos:", e); return { totalItems: 0 }; });
    const activeCampaignsP = pbAdmin.collection("advertising_campaigns").getList(1, 1, { requestKey: null, filter: pbAdmin.filter(`organization = {:orgId} && status = 'active'`, baseParams) }).catch((e) => { console.error("Err campaigns:", e); return { totalItems: 0 }; });

    const latestReputationP = pbAdmin.collection("seller_reputations").getList(1, 1, { 
      requestKey: null, filter: pbAdmin.filter(`organization = {:orgId}` + accFilter, baseParams),
      sort: "-created"
    }).catch((e) => { console.error("Err rep:", e); return { items: [] }; });

    const allListingsP = pbAdmin.collection("listings").getFullList({ requestKey: null, filter: pbAdmin.filter(`organization = {:orgId}` + accFilter, baseParams), fields: "status" }).catch((e) => { console.error("Err allListings:", e); return []; });
    const allPromotionsP = pbAdmin.collection("promotions").getFullList({ requestKey: null, filter: pbAdmin.filter(`organization = {:orgId}`, baseParams), fields: "status" }).catch((e) => { console.error("Err allPromos:", e); return []; });
    const accountsP = accountId === "all" ? pbAdmin.collection("mercado_livre_accounts").getFullList({ requestKey: null, filter: pbAdmin.filter(`organization = {:orgId}`, baseParams) }).catch((e) => { console.error("Err accounts:", e); return []; }) : Promise.resolve([]);

    const ordersP = pbAdmin.collection("orders").getFullList({
      requestKey: null, filter: pbAdmin.filter(`organization = {:orgId} && dateCreated >= {:start} && dateCreated <= {:end}` + accFilter, {
        ...baseParams,
        start: rangeStart.toISOString(), // Fix: use regular ISO string so it includes 'T'
        end: rangeEnd.toISOString(),     // Fix: use regular ISO string
      })
    }).catch((e) => { console.error("Err orders:", e); return []; });

    const [
      activeListingsRes,
      pausedListingsRes,
      pendingQuestionsRes,
      activeClaimsRes,
      lateShipmentsRes,
      activePromotionsRes,
      activeCampaignsRes,
      latestReputationRes,
      allListings,
      allPromotions,
      accountsList,
      orders
    ] = await Promise.all([
      activeListingsP,
      pausedListingsP,
      pendingQuestionsP,
      activeClaimsP,
      lateShipmentsP,
      activePromotionsP,
      activeCampaignsP,
      latestReputationP,
      allListingsP,
      allPromotionsP,
      accountsP,
      ordersP
    ]);

    let salesToday = 0;
    let revenueToday = 0;
    let cancelledOrders = 0;
    const ordersTotal = orders.length;

    const revenueByDayMap: Record<string, number> = {};
    const salesByDayMap: Record<string, number> = {};
    const accountStats: Record<string, { revenue: number; orders: number }> = {};

    for (const order of orders) {
      if (order.status === "cancelled") {
        cancelledOrders++;
        continue;
      }
      salesToday++;
      const amount = Number(order.totalAmount) || 0;
      revenueToday += amount;

      const dateStr = order.dateCreated ? new Date(order.dateCreated).toISOString().slice(0, 10) : "";
      if (dateStr) {
        revenueByDayMap[dateStr] = (revenueByDayMap[dateStr] || 0) + amount;
        salesByDayMap[dateStr] = (salesByDayMap[dateStr] || 0) + 1;
      }

      const accId = order.account;
      if (accId) {
        if (!accountStats[accId]) accountStats[accId] = { revenue: 0, orders: 0 };
        accountStats[accId].revenue += amount;
        accountStats[accId].orders++;
      }
    }

    const avgTicket = salesToday > 0 ? revenueToday / salesToday : 0;

    const revenueByDay: Array<{ date: string; revenue: number }> = [];
    const salesByDay: Array<{ date: string; count: number }> = [];

    for (let i = 0; i < rangeDays; i++) {
      const d = new Date(rangeStart);
      d.setDate(rangeStart.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      revenueByDay.push({ date: key, revenue: revenueByDayMap[key] || 0 });
      salesByDay.push({ date: key, count: salesByDayMap[key] || 0 });
    }

    const listingStatusMap: Record<string, number> = {};
    for (const l of allListings) {
      listingStatusMap[l.status] = (listingStatusMap[l.status] || 0) + 1;
    }
    const listingsByStatus = Object.entries(listingStatusMap).map(([status, count]) => ({ status, count }));

    const promotionStatusMap: Record<string, number> = {};
    for (const p of allPromotions) {
      promotionStatusMap[p.status] = (promotionStatusMap[p.status] || 0) + 1;
    }
    const promotionsByStatus = Object.entries(promotionStatusMap).map(([status, count]) => ({ status, count }));

    let performanceByAccount: Array<{ nickname: string; revenue: number; orders: number }> = [];
    if (accountId === "all") {
      for (const acc of accountsList) {
        const stats = accountStats[acc.id] || { revenue: 0, orders: 0 };
        performanceByAccount.push({
          nickname: acc.nickname || acc.meliUserId || acc.id,
          revenue: stats.revenue,
          orders: stats.orders,
        });
      }
    }

    const latestReputation = latestReputationRes.items[0];

    return NextResponse.json({
      success: true,
      cards: {
        salesToday,
        revenueToday,
        avgTicket,
        ordersTotal,
        activeListings: activeListingsRes.totalItems,
        pausedListings: pausedListingsRes.totalItems,
        pendingQuestions: pendingQuestionsRes.totalItems,
        activeClaims: activeClaimsRes.totalItems,
        cancelledOrders,
        lateShipments: lateShipmentsRes.totalItems,
        activePromotions: activePromotionsRes.totalItems,
        activeCampaigns: activeCampaignsRes.totalItems,
        reputation: latestReputation
          ? {
              levelId: latestReputation.levelId,
              powerSellerStatus: latestReputation.powerSellerStatus,
              claimsRate: Number(latestReputation.claimsRate) || 0,
              cancellationsRate: Number(latestReputation.cancellationsRate) || 0,
              delayedHandlingTimeRate: Number(latestReputation.delayedHandlingTimeRate) || 0,
              salesCompleted: latestReputation.metricsSalesCompleted || latestReputation.salesCompleted || 0,
            }
          : null,
      },
      charts: {
        revenueByDay,
        salesByDay,
        listingsByStatus,
        performanceByAccount,
        promotionsByStatus,
      },
    });
  } catch (error: any) {
    console.error("GET /api/dashboard/metrics error:", error);
    return NextResponse.json(
      { error: "Erro interno ao carregar métricas do painel." },
      { status: 500 }
    );
  }
}
