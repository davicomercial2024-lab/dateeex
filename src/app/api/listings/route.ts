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

    const result = await pbAdmin.collection("listings").getList(page, limit, {
      filter,
      sort: "-created",
      expand: "account"
    });

    const listings = result.items.map((item: any) => ({
      id: item.id,
      mlItemId: item.mlItemId,
      title: item.title,
      price: item.price,
      currencyId: item.currencyId || "BRL",
      availableQuantity: item.availableQuantity,
      soldQuantity: item.soldQuantity,
      status: item.status,
      permalink: item.permalink,
      thumbnail: item.thumbnail,
      mercadoLivreAccountId: item.account,
      mercadoLivreAccount: item.expand?.account ? { nickname: item.expand.account.nickname } : null,
    }));

    return NextResponse.json({ success: true, listings, total: result.totalItems });
  } catch (err: any) {
    console.error("GET /api/listings error:", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
