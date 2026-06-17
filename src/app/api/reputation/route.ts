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

    if (accountId === "all") {
      const accounts = await pbAdmin.collection("mercado_livre_accounts").getFullList({
        filter: `organization="${payload.orgId}"`,
      });

      const reputations = await Promise.all(
        accounts.map(async (acc) => {
          try {
            const rep = await pbAdmin.collection("seller_reputations").getFirstListItem(`account="${acc.id}"`, {
              sort: "-created"
            });
            return { ...rep, account: { nickname: acc.nickname, meliUserId: acc.meliUserId } };
          } catch (e) {
            return null;
          }
        })
      );

      return NextResponse.json({
        success: true,
        reputations: reputations.filter(Boolean),
        single: null,
      });
    } else {
      let account;
      try {
        account = await pbAdmin.collection("mercado_livre_accounts").getFirstListItem(`id="${accountId}" && organization="${payload.orgId}"`);
      } catch (e) {
        return NextResponse.json({ error: "Conta não encontrada." }, { status: 403 });
      }

      let rep = null;
      try {
        rep = await pbAdmin.collection("seller_reputations").getFirstListItem(`account="${accountId}"`, {
          sort: "-created"
        });
      } catch (e) {
        // Not found
      }

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
