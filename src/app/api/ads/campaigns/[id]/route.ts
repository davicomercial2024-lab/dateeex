import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { pbAdmin } from "@/lib/pb";
import { MercadoLivreApiService } from "@/services/mercado-livre-api.service";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("datex_session")?.value;
    if (!token) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const session = await verifyToken(token);
    if (!session) return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });

    const { id } = await params;
    const campaignId = parseInt(id, 10);
    if (isNaN(campaignId)) {
      return NextResponse.json({ error: "ID da campanha inválido" }, { status: 400 });
    }

    const { status, daily_budget, accountId } = await request.json();

    if (!accountId) {
      return NextResponse.json({ error: "O accountId é obrigatório para realizar a mutação na API do Mercado Livre" }, { status: 400 });
    }

    // Valida se a conta pertence à organização e obtém o token
    let pbAccount;
    try {
      pbAccount = await pbAdmin.collection("mercado_livre_accounts").getFirstListItem(
        `id = "${accountId}" && organization = "${session.orgId}"`
      );
    } catch (err) {
      // Not found
    }

    let accountToken = null;
    if (pbAccount) {
      try {
        accountToken = await pbAdmin.collection("oauth_tokens").getFirstListItem(`account = "${pbAccount.id}"`);
      } catch (err) {
        // No token
      }
    }

    const account = pbAccount ? { ...pbAccount, token: accountToken } : null;

    if (!account || !account.token) {
      return NextResponse.json({ error: "Conta não encontrada ou sem token" }, { status: 404 });
    }

    // Faz a chamada de mutação
    const payload: any = {};
    if (status !== undefined) payload.status = status;
    if (daily_budget !== undefined) payload.daily_budget = daily_budget;

    const result = await MercadoLivreApiService.updateCampaign(campaignId, account.token.accessToken, payload);

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    const routeParams = await params;
    console.error(`Erro PATCH /api/ads/campaigns/${routeParams.id}:`, error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
