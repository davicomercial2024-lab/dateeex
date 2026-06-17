import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { pbAdmin } from "@/lib/pb";
import { verifyToken } from "@/lib/auth";
import { MercadoLivreApiService } from "@/services/mercado-livre-api.service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("datex_session");
    if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    const payload = await verifyToken(session.value);
    if (!payload) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });

    const { id } = await params;

    const account = await pbAdmin.collection("mercado_livre_accounts").getOne(id).catch(() => null);

    if (!account || account.organization !== payload.orgId) {
      return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });
    }

    const tokens = await pbAdmin.collection("oauth_tokens").getFullList({
      filter: pbAdmin.filter("account = {:id}", { id: account.id }),
    });
    const token = tokens[0] || null;

    if (!token) {
      return NextResponse.json({
        success: true,
        result: {
          ok: false,
          status: "Sem token OAuth",
          message: "Esta conta não possui token salvo. Reconecte via OAuth.",
          icon: "error",
        },
      });
    }

    if (token.accessToken.includes("mock-token")) {
      return NextResponse.json({
        success: true,
        result: {
          ok: false,
          status: "Token inválido (sandbox)",
          message: "Esta conta usa token sandbox. Reconecte via OAuth real para usar a API.",
          icon: "warning",
        },
      });
    }

    const now = new Date();
    const isExpired = new Date(token.expiresAt) < now;

    let accessToken = token.accessToken;

    if (isExpired) {
      try {
        const refreshed = await MercadoLivreApiService.refreshToken(token.refreshToken);
        if (refreshed?.access_token) {
          accessToken = refreshed.access_token;
          
          await pbAdmin.collection("oauth_tokens").update(token.id, {
            accessToken: refreshed.access_token,
            refreshToken: refreshed.refresh_token || token.refreshToken,
            expiresAt: new Date(Date.now() + (refreshed.expires_in || 21600) * 1000).toISOString(),
          });
          
          await pbAdmin.collection("mercado_livre_accounts").update(id, {
            status: "CONNECTED"
          });
        }
      } catch (refreshErr: any) {
        return NextResponse.json({
          success: true,
          result: {
            ok: false,
            status: "Token expirado — falha na renovação",
            message: "O token expirou e não foi possível renová-lo. Reconecte a conta via OAuth.",
            icon: "error",
          },
        });
      }
    }

    const meliRes = await fetch("https://api.mercadolibre.com/users/me", {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });

    if (!meliRes.ok) {
      if (meliRes.status === 401) {
        await pbAdmin.collection("mercado_livre_accounts").update(id, { status: "EXPIRED" });
      }
      return NextResponse.json({
        success: true,
        result: {
          ok: false,
          status: `Falha na API (HTTP ${meliRes.status})`,
          message: meliRes.status === 401
            ? "Token rejeitado pelo Mercado Livre. Reconecte a conta."
            : `Mercado Livre retornou erro ${meliRes.status}. Tente novamente.`,
          icon: "error",
        },
      });
    }

    const userData = await meliRes.json();
    const returnedId = String(userData.id);

    if (returnedId !== account.meliUserId) {
      return NextResponse.json({
        success: true,
        result: {
          ok: false,
          status: "Conta divergente",
          message: `A API retornou o ID ${returnedId} mas esta conta tem ID ${account.meliUserId}. Pode ser uma configuração incorreta.`,
          icon: "warning",
        },
      });
    }

    await pbAdmin.collection("mercado_livre_accounts").update(id, {
      status: "CONNECTED",
      nickname: userData.nickname?.toUpperCase() || account.nickname,
    });

    const message = isExpired
      ? "Token expirado e renovado com sucesso. Conexão ativa."
      : "Conexão ativa com o Mercado Livre.";

    return NextResponse.json({
      success: true,
      result: {
        ok: true,
        status: isExpired ? "Token renovado com sucesso" : "Conexão ativa",
        message,
        icon: "success",
        data: {
          meliUserId: returnedId,
          nickname: userData.nickname,
          siteId: userData.site_id,
        },
      },
    });
  } catch (err: any) {
    console.error("POST .../test-connection error:", err);
    return NextResponse.json({
      success: true,
      result: {
        ok: false,
        status: "Erro de conexão",
        message: `Não foi possível alcançar a API: ${err.message}`,
        icon: "error",
      },
    });
  }
}
