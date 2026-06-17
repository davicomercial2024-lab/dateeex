import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { pbAdmin } from "@/lib/pb";
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

    let filter = pbAdmin.filter("organization = {:orgId}", { orgId: payload.orgId });
    if (accountId !== "all") {
      filter += pbAdmin.filter(" && id = {:accountId}", { accountId });
    }

    const accounts = await pbAdmin.collection("mercado_livre_accounts").getFullList({
      filter,
      sort: "created",
    });

    const diagnostics = await Promise.all(
      accounts.map(async (acc) => {
        const now = new Date();
        const tokens = await pbAdmin.collection("oauth_tokens").getFullList({
          filter: pbAdmin.filter("account = {:id}", { id: acc.id }),
        });
        const token = tokens[0] || null;
        
        const isExpired = token ? new Date(token.expiresAt) < now : true;
        const isMock = token ? token.accessToken.includes("mock-token") : false;

        const [listingsRes, ordersRes, questionsRes] = await Promise.all([
          pbAdmin.collection("listings").getList(1, 1, { filter: pbAdmin.filter("account = {:id}", { id: acc.id }) }),
          pbAdmin.collection("orders").getList(1, 1, { filter: pbAdmin.filter("account = {:id}", { id: acc.id }) }),
          pbAdmin.collection("questions").getList(1, 1, { filter: pbAdmin.filter("account = {:id}", { id: acc.id }) }),
        ]);

        const lastAuditLogRes = await pbAdmin.collection("audit_logs").getList(1, 1, {
          filter: pbAdmin.filter("mercadoLivreAccountId = {:id}", { id: acc.id }),
          sort: "-created",
        }).catch(() => ({ items: [] }));
        const lastAuditLog = lastAuditLogRes.items[0] || null;

        const lastSyncLogRes = await pbAdmin.collection("audit_logs").getList(1, 1, {
          filter: pbAdmin.filter("mercadoLivreAccountId = {:id} && (action = 'SYNC_SUCCESS' || action = 'SYNC_PARTIAL' || action = 'SYNC_FAILED')", { id: acc.id }),
          sort: "-created",
        }).catch(() => ({ items: [] }));
        const lastSyncLog = lastSyncLogRes.items[0] || null;

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
          token: token
            ? {
                expiresAt: new Date(token.expiresAt).toISOString(),
                isExpired,
                isMock,
                minutesUntilExpiry: Math.floor((new Date(token.expiresAt).getTime() - now.getTime()) / 60000),
              }
            : null,
          counts: { listings: listingsRes.totalItems, orders: ordersRes.totalItems, questions: questionsRes.totalItems },
          lastAuditLog: lastAuditLog ? { action: lastAuditLog.action, details: lastAuditLog.details, createdAt: new Date(lastAuditLog.created).toISOString() } : null,
          lastSyncLog: lastSyncLog ? { action: lastSyncLog.action, details: lastSyncLog.details, createdAt: new Date(lastSyncLog.created).toISOString() } : null,
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

    const accounts = await pbAdmin.collection("mercado_livre_accounts").getFullList({
      filter: pbAdmin.filter("id = {:accountId} && organization = {:orgId}", { accountId, orgId: payload.orgId }),
    });
    const account = accounts[0] || null;

    if (!account) return NextResponse.json({ error: "Conta nao encontrada." }, { status: 404 });
    
    const tokens = await pbAdmin.collection("oauth_tokens").getFullList({
      filter: pbAdmin.filter("account = {:id}", { id: account.id }),
    });
    const token = tokens[0] || null;

    if (!token) {
      return NextResponse.json({
        success: true,
        testResult: { ok: false, statusCode: 0, error: "Nenhum token salvo para esta conta." },
      });
    }

    if (token.accessToken.includes("mock-token")) {
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
        Authorization: `Bearer ${token.accessToken}`,
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
