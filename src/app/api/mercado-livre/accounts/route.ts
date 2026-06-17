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

    await pbAdmin.admins.authWithPassword(process.env.PB_ADMIN_EMAIL || 'bbbaterias@bbdi.com.br', process.env.PB_ADMIN_PASS || 'diev1pn4753ikpf');

    const filterStr = includeInactive 
      ? `organization="${payload.orgId}"` 
      : `organization="${payload.orgId}" && isActive=true`;

    const accounts = await pbAdmin.collection("mercado_livre_accounts").getFullList({
      filter: filterStr,
      sort: "-isDefault,created",
    });

    const accountsWithCounts = accounts.map((acc) => {
      return {
        ...acc,
        displayName: acc.nicknameCustom || acc.nickname,
        lastSyncAt: acc.lastSyncAt || null,
        connectedAt: acc.created,
        disconnectedAt: acc.disconnectedAt || null,
        createdAt: acc.created,
        counts: { listings: 0, orders: 0, questions: 0 },
      };
    });

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
