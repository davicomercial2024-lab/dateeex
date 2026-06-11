import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("datex_session");
    if (!session) return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });

    const payload = await verifyToken(session.value);
    if (!payload) return NextResponse.json({ error: "Sessao expirada." }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId") || "all";

    const accounts = await prisma.mercadoLivreAccount.findMany({
      where: {
        organizationId: payload.orgId,
        ...(accountId !== "all" ? { id: accountId } : {}),
      },
      include: { token: true },
      orderBy: { createdAt: "asc" },
    });

    const diagnostics = await Promise.all(
      accounts.map(async (acc) => {
        const now = new Date();
        const isExpired = acc.token ? acc.token.expiresAt < now : true;
        const isMock = acc.token ? acc.token.accessToken.includes("mock-token") : false;

        const [listingsCount, ordersCount, questionsCount] = await Promise.all([
          prisma.listing.count({ where: { mercadoLivreAccountId: acc.id } }),
          prisma.order.count({ where: { mercadoLivreAccountId: acc.id } }),
          prisma.question.count({ where: { mercadoLivreAccountId: acc.id } }),
        ]);

        const lastAuditLog = await prisma.auditLog.findFirst({
          where: { mercadoLivreAccountId: acc.id },
          orderBy: { createdAt: "desc" },
          select: { action: true, details: true, createdAt: true },
        });

        const lastSyncLog = await prisma.auditLog.findFirst({
          where: {
            mercadoLivreAccountId: acc.id,
            action: { in: ["SYNC_SUCCESS", "SYNC_PARTIAL", "SYNC_FAILED"] },
          },
          orderBy: { createdAt: "desc" },
          select: { action: true, details: true, createdAt: true },
        });

        return {
          account: {
            id: acc.id,
            nickname: acc.nickname,
            meliUserId: acc.meliUserId,
            email: acc.email,
            status: acc.status,
            lastSyncStatus: acc.lastSyncStatus,
            lastSyncProgress: acc.lastSyncProgress,
          },
          token: acc.token
            ? {
                expiresAt: acc.token.expiresAt.toISOString(),
                isExpired,
                isMock,
                minutesUntilExpiry: Math.floor((acc.token.expiresAt.getTime() - now.getTime()) / 60000),
              }
            : null,
          counts: { listings: listingsCount, orders: ordersCount, questions: questionsCount },
          lastAuditLog: lastAuditLog ? { ...lastAuditLog, createdAt: lastAuditLog.createdAt.toISOString() } : null,
          lastSyncLog: lastSyncLog ? { ...lastSyncLog, createdAt: lastSyncLog.createdAt.toISOString() } : null,
        };
      })
    );

    return NextResponse.json({ success: true, diagnostics });
  } catch (err: any) {
    console.error("GET /api/integrations/diagnostics error:", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("datex_session");
    if (!session) return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });

    const payload = await verifyToken(session.value);
    if (!payload) return NextResponse.json({ error: "Sessao expirada." }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const { accountId } = body;

    if (!accountId) {
      return NextResponse.json({ error: "accountId e obrigatorio." }, { status: 400 });
    }

    const account = await prisma.mercadoLivreAccount.findFirst({
      where: { id: accountId, organizationId: payload.orgId },
      include: { token: true },
    });

    if (!account) return NextResponse.json({ error: "Conta nao encontrada." }, { status: 404 });
    if (!account.token) {
      return NextResponse.json({
        success: true,
        testResult: { ok: false, statusCode: 0, error: "Nenhum token salvo para esta conta." },
      });
    }

    if (account.token.accessToken.includes("mock-token")) {
      return NextResponse.json({
        success: true,
        testResult: {
          ok: false,
          statusCode: 0,
          error: "Esta conta usa um token de sandbox/mock. Reconecte via OAuth oficial para usar a API real.",
        },
      });
    }

    const meliRes = await fetch("https://api.mercadolibre.com/users/me", {
      headers: {
        Authorization: `Bearer ${account.token.accessToken}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (meliRes.ok) {
      const meliData = await meliRes.json();
      return NextResponse.json({
        success: true,
        testResult: {
          ok: true,
          statusCode: meliRes.status,
          nickname: meliData.nickname,
          meliUserId: meliData.id,
        },
      });
    }

    const errText = await meliRes.text().catch(() => "Sem detalhes");
    return NextResponse.json({
      success: true,
      testResult: {
        ok: false,
        statusCode: meliRes.status,
        error: `Meli API retornou ${meliRes.status}: ${errText.substring(0, 200)}`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({
      success: true,
      testResult: { ok: false, statusCode: 0, error: `Erro de rede: ${err.message}` },
    });
  }
}
