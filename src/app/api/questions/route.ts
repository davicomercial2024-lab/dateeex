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
    const statusFilter = searchParams.get("status") || undefined;

    let where: Record<string, unknown> = { organizationId: payload.orgId };

    if (accountId !== "all") {
      const account = await prisma.mercadoLivreAccount.findFirst({
        where: { id: accountId, organizationId: payload.orgId },
      });
      if (!account) return NextResponse.json({ error: "Conta não encontrada." }, { status: 403 });
      where.mercadoLivreAccountId = accountId;
    }

    if (statusFilter) where.status = statusFilter;

    const [questions, total] = await Promise.all([
      prisma.question.findMany({
        where,
        orderBy: { dateCreated: "desc" },
        take: 100,
        include: {
          mercadoLivreAccount: { select: { nickname: true } },
        },
      }),
      prisma.question.count({ where }),
    ]);

    return NextResponse.json({ success: true, questions, total });
  } catch (err: any) {
    console.error("GET /api/questions error:", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
