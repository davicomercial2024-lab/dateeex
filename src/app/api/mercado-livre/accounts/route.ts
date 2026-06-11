import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
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

    const accounts = await prisma.mercadoLivreAccount.findMany({
      where: {
        organizationId: payload.orgId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: [{ isDefault: "desc" }, { connectedAt: "asc" }],
      select: {
        id: true,
        meliUserId: true,
        nickname: true,
        nicknameCustom: true,
        email: true,
        siteId: true,
        countryId: true,
        status: true,
        isActive: true,
        isDefault: true,
        lastSyncAt: true,
        lastSyncStatus: true,
        lastSyncProgress: true,
        lastSyncError: true,
        connectedAt: true,
        disconnectedAt: true,
        createdAt: true,
        // Não retornar token
      },
    });

    // Conta registros por conta para o diagnóstico
    const accountsWithCounts = await Promise.all(
      accounts.map(async (acc) => {
        const [listingsCount, ordersCount, questionsCount] = await Promise.all([
          prisma.listing.count({ where: { mercadoLivreAccountId: acc.id } }),
          prisma.order.count({ where: { mercadoLivreAccountId: acc.id } }),
          prisma.question.count({ where: { mercadoLivreAccountId: acc.id } }),
        ]);

        return {
          ...acc,
          displayName: acc.nicknameCustom || acc.nickname,
          lastSyncAt: acc.lastSyncAt?.toISOString() ?? null,
          connectedAt: acc.connectedAt.toISOString(),
          disconnectedAt: acc.disconnectedAt?.toISOString() ?? null,
          createdAt: acc.createdAt.toISOString(),
          counts: { listings: listingsCount, orders: ordersCount, questions: questionsCount },
        };
      })
    );

    return NextResponse.json({ success: true, accounts: accountsWithCounts });
  } catch (err: any) {
    console.error("GET /api/mercado-livre/accounts error:", err);
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
