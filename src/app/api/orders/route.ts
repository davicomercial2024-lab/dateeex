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
    if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    const payload = await verifyToken(session.value);
    if (!payload) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId") || "all";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, parseInt(searchParams.get("limit") || "50"));
    const statusFilter = searchParams.get("status") || undefined;

    let filter = `organization="${payload.orgId}"`;

    if (accountId !== "all") {
      try {
        const account = await pbAdmin.collection("mercado_livre_accounts").getFirstListItem(`id="${accountId}" && organization="${payload.orgId}"`);
        if (!account) throw new Error("Not found");
        filter += ` && account="${accountId}"`;
      } catch (e) {
        return NextResponse.json({ error: "Conta não encontrada." }, { status: 403 });
      }
    }

    if (statusFilter) {
      filter += ` && status="${statusFilter}"`;
    }

    const result = await pbAdmin.collection("orders").getList(page, limit, {
      filter,
      sort: "-dateCreated",
      expand: "account"
    });

    const orders = result.items.map(item => ({
      ...item,
      orderItems: [],
      mercadoLivreAccount: item.expand?.account ? { nickname: item.expand.account.nickname } : null
    }));

    return NextResponse.json({ success: true, orders: orders, total: result.totalItems });
  } catch (err: any) {
    console.error("GET /api/orders error:", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
