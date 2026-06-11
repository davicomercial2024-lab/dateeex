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
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, parseInt(searchParams.get("limit") || "50"));
    const statusFilter = searchParams.get("status") || undefined;
    const skip = (page - 1) * limit;

    let where: Record<string, unknown> = { organizationId: payload.orgId };

    if (accountId !== "all") {
      const account = await prisma.mercadoLivreAccount.findFirst({
        where: { id: accountId, organizationId: payload.orgId },
      });
      if (!account) return NextResponse.json({ error: "Conta não encontrada." }, { status: 403 });
      where.mercadoLivreAccountId = accountId;
    }

    if (statusFilter) {
      where.status = statusFilter;
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { dateCreated: "desc" },
        skip,
        take: limit,
        include: {
          orderItems: { select: { mlItemId: true, title: true, quantity: true, unitPrice: true } },
          mercadoLivreAccount: { select: { nickname: true } },
        },
      }),
      prisma.order.count({ where }),
    ]);

    return NextResponse.json({ success: true, orders, total });
  } catch (err: any) {
    console.error("GET /api/orders error:", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
