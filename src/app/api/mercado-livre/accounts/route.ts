import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { pbAdmin } from "@/lib/pb";
import { verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/mercado-livre/accounts
 * Lista as contas Mercado Livre ATIVAS da organização.
 * Inclui displayName, counts e todos os campos de status.
 *
 * POST /api/mercado-livre/accounts
 * Retorna 405 — contas só podem ser criadas via OAuth oficial.
 */

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("datex_session");
    if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    const payload = await verifyToken(session.value);
    if (!payload) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("includeInactive") === "true";

    await pbAdmin.admins.authWithPassword(process.env.PB_ADMIN_EMAIL as string, process.env.PB_ADMIN_PASS as string);

    const filterStr = includeInactive 
      ? `organization="${payload.orgId}"` 
      : `organization="${payload.orgId}" && isActive=true`;

    console.log(`[API /accounts] Fetching accounts for org ${payload.orgId} with filter: ${filterStr}`);

    const accounts = await pbAdmin.collection("mercado_livre_accounts").getFullList({
      filter: filterStr,
    });

    accounts.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());

    console.log(`[API /accounts] Found ${accounts.length} accounts.`);

    const accountsWithCounts = await Promise.all(accounts.map(async (acc) => {
      const [listings, orders, questions] = await Promise.all([
        pbAdmin.collection("listings").getList(1, 1, { filter: `account="${acc.id}"` }).catch((err) => { console.error("Error listings", err); return { totalItems: 0 } }),
        pbAdmin.collection("orders").getList(1, 1, { filter: `account="${acc.id}"` }).catch((err) => { console.error("Error orders", err); return { totalItems: 0 } }),
        pbAdmin.collection("questions").getList(1, 1, { filter: `account="${acc.id}"` }).catch((err) => { console.error("Error questions", err); return { totalItems: 0 } }),
      ]);

      return {
        ...acc,
        displayName: acc.nicknameCustom || acc.nickname,
        lastSyncAt: acc.lastSyncAt || null,
        connectedAt: acc.created,
        disconnectedAt: acc.disconnectedAt || null,
        createdAt: acc.created,
        counts: {
          listings: listings.totalItems,
          orders: orders.totalItems,
          questions: questions.totalItems,
        },
      };
    }));

    return NextResponse.json({ success: true, accounts: accountsWithCounts });
  } catch (err: any) {
    console.error("GET /api/mercado-livre/accounts error:", err?.response || err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

// POST está desativado — contas apenas via OAuth oficial
export async function POST() {
  return NextResponse.json(
    {
      error: "Método não permitido. Para adicionar uma conta Mercado Livre, use o fluxo OAuth oficial.",
      action: "oauth_required",
    },
    { status: 405 }
  );
}
