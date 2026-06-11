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
    if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    const payload = await verifyToken(session.value);
    if (!payload) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId") || "all";

    if (accountId === "all") {
      // Retorna última reputação por conta
      const accounts = await prisma.mercadoLivreAccount.findMany({
        where: { organizationId: payload.orgId },
        select: { id: true, nickname: true, meliUserId: true },
      });

      const reputations = await Promise.all(
        accounts.map(async (acc) => {
          const rep = await prisma.sellerReputation.findFirst({
            where: { mercadoLivreAccountId: acc.id },
            orderBy: { createdAt: "desc" },
          });
          return rep ? { ...rep, account: { nickname: acc.nickname, meliUserId: acc.meliUserId } } : null;
        })
      );

      return NextResponse.json({
        success: true,
        reputations: reputations.filter(Boolean),
        single: null,
      });
    } else {
      const account = await prisma.mercadoLivreAccount.findFirst({
        where: { id: accountId, organizationId: payload.orgId },
        select: { id: true, nickname: true, meliUserId: true },
      });
      if (!account) return NextResponse.json({ error: "Conta não encontrada." }, { status: 403 });

      const rep = await prisma.sellerReputation.findFirst({
        where: { mercadoLivreAccountId: accountId },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json({
        success: true,
        reputations: rep ? [{ ...rep, account: { nickname: account.nickname, meliUserId: account.meliUserId } }] : [],
        single: rep ? { ...rep, account } : null,
      });
    }
  } catch (err: any) {
    console.error("GET /api/reputation error:", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
