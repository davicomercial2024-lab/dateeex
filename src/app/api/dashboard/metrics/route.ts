import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
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

// GET /api/dashboard/metrics?accountId=all|{uuid}
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

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId") || "all";
    const period = searchParams.get("period") || "30";
    const customDate = parseLocalDate(searchParams.get("date"));

    const orgId = payload.orgId;

    // Monta o filtro base dependendo se é "all" ou uma conta específica
    let accountFilter: { organizationId: string; mercadoLivreAccountId?: string } = {
      organizationId: orgId,
    };
    let listingAccountFilter: { organizationId: string; mercadoLivreAccountId?: string } = {
      organizationId: orgId,
    };
    let promotionFilter: { organizationId: string } = { organizationId: orgId };

    if (accountId !== "all") {
      // Valida que a conta pertence à organização
      const account = await prisma.mercadoLivreAccount.findFirst({
        where: { id: accountId, organizationId: orgId },
      });
      if (!account) {
        return NextResponse.json(
          { error: "Conta não encontrada ou acesso negado." },
          { status: 403 }
        );
      }
      accountFilter.mercadoLivreAccountId = accountId;
      listingAccountFilter.mercadoLivreAccountId = accountId;
    }

    const shipmentAccountIds =
      accountId !== "all"
        ? [accountId]
        : (
            await prisma.mercadoLivreAccount.findMany({
              where: { organizationId: orgId },
              select: { id: true },
            })
          ).map((account) => account.id);

    // Define o início do dia de hoje (UTC-3 Brasil)
    const today = startOfDay(new Date());
    const rangeEnd = period === "custom" && customDate ? endOfDay(customDate) : endOfDay(today);
    const rangeStart =
      period === "custom" && customDate
        ? startOfDay(customDate)
        : startOfDay(new Date(today.getTime() - ((PERIOD_DAYS[period] ?? 30) - 1) * 24 * 60 * 60 * 1000));
    const rangeDays =
      Math.floor((startOfDay(rangeEnd).getTime() - rangeStart.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    const dateRange = { gte: rangeStart, lte: rangeEnd };

    // -------------------------------------------------------------------------
    // 1. MÉTRICAS DE CARDS — Execução em paralelo para performance máxima
    // -------------------------------------------------------------------------
    const [
      salesToday,
      revenueTodayAgg,
      avgTicketAgg,
      ordersTotal,
      activeListings,
      pausedListings,
      pendingQuestions,
      activeClaims,
      cancelledOrders,
      lateShipments,
      activePromotions,
      activeCampaigns,
      latestReputation,
    ] = await Promise.all([
      // Vendas hoje (COUNT)
      prisma.order.count({
        where: {
          ...accountFilter,
          dateCreated: dateRange,
          NOT: { status: "cancelled" },
        },
      }),

      // Faturamento hoje (SUM totalAmount)
      prisma.order.aggregate({
        where: {
          ...accountFilter,
          dateCreated: dateRange,
          NOT: { status: "cancelled" },
        },
        _sum: { totalAmount: true },
      }),

      // Ticket médio (AVG totalAmount — últimos 30 dias excluindo cancelados)
      prisma.order.aggregate({
        where: {
          ...accountFilter,
          dateCreated: dateRange,
          NOT: { status: "cancelled" },
        },
        _avg: { totalAmount: true },
      }),

      // Total de pedidos (todos os status)
      prisma.order.count({ where: { ...accountFilter, dateCreated: dateRange } }),

      // Anúncios ativos
      prisma.listing.count({
        where: { ...listingAccountFilter, status: "active" },
      }),

      // Anúncios pausados
      prisma.listing.count({
        where: { ...listingAccountFilter, status: "paused" },
      }),

      // Perguntas pendentes (sem resposta)
      prisma.question.count({
        where: { ...accountFilter, status: "unanswered" },
      }),

      // Reclamações abertas (não fechadas)
      prisma.claim.count({
        where: { ...accountFilter, NOT: { stage: "closed" } },
      }),

      // Cancelamentos
      prisma.order.count({
        where: { ...accountFilter, status: "cancelled", dateCreated: dateRange },
      }),

      // Envios com atraso (ready_to_ship ou handling com mais de 2 dias sem movimento)
      prisma.shipment.count({
        where: {
          mercadoLivreAccountId: { in: shipmentAccountIds },
          status: { in: ["ready_to_ship", "handling"] },
          dateCreated: {
            lt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          },
        },
      }),

      // Promoções ativas
      prisma.promotion.count({
        where: { ...promotionFilter, status: "active" },
      }),

      // Campanhas Ads ativas
      prisma.advertisingCampaign.count({
        where: { organizationId: orgId, status: "active" },
      }),

      // Última reputação registrada
      accountId !== "all"
        ? prisma.sellerReputation.findFirst({
            where: { mercadoLivreAccountId: accountId },
            orderBy: { createdAt: "desc" },
          })
        : prisma.sellerReputation.findFirst({
            where: { organizationId: orgId },
            orderBy: { createdAt: "desc" },
          }),
    ]);

    // -------------------------------------------------------------------------
    // 2. DADOS PARA GRÁFICOS
    // -------------------------------------------------------------------------

    // Faturamento por dia (últimos 30 dias)
    const ordersForCharts = await prisma.order.findMany({
      where: {
        ...accountFilter,
        dateCreated: dateRange,
        NOT: { status: "cancelled" },
      },
      select: {
        dateCreated: true,
        totalAmount: true,
        status: true,
        mercadoLivreAccountId: true,
      },
      orderBy: { dateCreated: "asc" },
    });

    // Agrupa pedidos por dia para faturamento e contagem de vendas
    const revenueByDayMap: Record<string, number> = {};
    const salesByDayMap: Record<string, number> = {};

    for (const order of ordersForCharts) {
      const dayKey = order.dateCreated.toISOString().slice(0, 10);
      const amount = Number(order.totalAmount) || 0;
      revenueByDayMap[dayKey] = (revenueByDayMap[dayKey] || 0) + amount;
      salesByDayMap[dayKey] = (salesByDayMap[dayKey] || 0) + 1;
    }

    // Garante todos os 30 dias no array (zero nos dias sem pedidos)
    const revenueByDay: Array<{ date: string; revenue: number }> = [];
    const salesByDay: Array<{ date: string; count: number }> = [];

    for (let i = 0; i < rangeDays; i++) {
      const d = new Date(rangeStart);
      d.setDate(rangeStart.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      revenueByDay.push({ date: key, revenue: revenueByDayMap[key] || 0 });
      salesByDay.push({ date: key, count: salesByDayMap[key] || 0 });
    }

    // Anúncios por status
    const listingStatusGroups = await prisma.listing.groupBy({
      by: ["status"],
      where: listingAccountFilter,
      _count: { id: true },
    });
    const listingsByStatus = listingStatusGroups.map((g) => ({
      status: g.status,
      count: g._count.id,
    }));

    // Performance por conta (apenas no modo "todas as contas")
    let performanceByAccount: Array<{
      nickname: string;
      revenue: number;
      orders: number;
    }> = [];

    if (accountId === "all") {
      const accounts = await prisma.mercadoLivreAccount.findMany({
        where: { organizationId: orgId },
        select: { id: true, nickname: true },
      });

      for (const acc of accounts) {
        const accOrders = await prisma.order.aggregate({
          where: {
            mercadoLivreAccountId: acc.id,
            dateCreated: dateRange,
            NOT: { status: "cancelled" },
          },
          _sum: { totalAmount: true },
          _count: { id: true },
        });
        performanceByAccount.push({
          nickname: acc.nickname,
          revenue: Number(accOrders._sum.totalAmount) || 0,
          orders: accOrders._count.id,
        });
      }
    }

    // Promoções por status
    const promotionStatusGroups = await prisma.promotion.groupBy({
      by: ["status"],
      where: promotionFilter,
      _count: { id: true },
    });
    const promotionsByStatus = promotionStatusGroups.map((g) => ({
      status: g.status,
      count: g._count.id,
    }));

    // -------------------------------------------------------------------------
    // 3. MONTA RESPOSTA FINAL
    // -------------------------------------------------------------------------
    return NextResponse.json({
      success: true,
      cards: {
        salesToday,
        revenueToday: Number(revenueTodayAgg._sum.totalAmount) || 0,
        avgTicket: Number(avgTicketAgg._avg.totalAmount) || 0,
        ordersTotal,
        activeListings,
        pausedListings,
        pendingQuestions,
        activeClaims,
        cancelledOrders,
        lateShipments,
        activePromotions,
        activeCampaigns,
        reputation: latestReputation
          ? {
              levelId: latestReputation.levelId,
              powerSellerStatus: latestReputation.powerSellerStatus,
              claimsRate: Number(latestReputation.claimsRate),
              cancellationsRate: Number(latestReputation.cancellationsRate),
              delayedHandlingTimeRate: Number(latestReputation.delayedHandlingTimeRate),
              salesCompleted: latestReputation.salesCompleted,
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
