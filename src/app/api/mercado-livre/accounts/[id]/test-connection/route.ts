import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { MercadoLivreApiService } from "@/services/mercado-livre-api.service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/mercado-livre/accounts/[id]/test-connection
 * Testa a conexão com a API do Mercado Livre usando o token salvo.
 * Compara o meliUserId retornado com o salvo no banco.
 */
export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("datex_session");
    if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    const payload = await verifyToken(session.value);
    if (!payload) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });

    const { id } = await params;

    const account = await prisma.mercadoLivreAccount.findFirst({
      where: { id, organizationId: payload.orgId },
      include: { token: true },
    });

    if (!account) return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });

    if (!account.token) {
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

    // Verifica se é mock
    if (account.token.accessToken.includes("mock-token")) {
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
    const isExpired = account.token.expiresAt < now;

    // Tenta usar o token atual (ou renovar se expirado)
    let accessToken = account.token.accessToken;

    if (isExpired) {
      // Tenta renovar via refresh_token
      try {
        const refreshed = await MercadoLivreApiService.refreshToken(account.token.refreshToken);
        if (refreshed?.access_token) {
          accessToken = refreshed.access_token;
          // Salva token renovado
          await prisma.oAuthToken.update({
            where: { mercadoLivreAccountId: id },
            data: {
              accessToken: refreshed.access_token,
              refreshToken: refreshed.refresh_token || account.token.refreshToken,
              expiresAt: new Date(Date.now() + (refreshed.expires_in || 21600) * 1000),
            },
          });
          await prisma.mercadoLivreAccount.update({
            where: { id },
            data: { status: "CONNECTED" },
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

    // Faz a chamada /users/me
    const meliRes = await fetch("https://api.mercadolibre.com/users/me", {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });

    if (!meliRes.ok) {
      // Atualiza status da conta se o token foi rejeitado
      if (meliRes.status === 401) {
        await prisma.mercadoLivreAccount.update({
          where: { id },
          data: { status: "EXPIRED" },
        });
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

    // Compara o meliUserId retornado com o salvo
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

    // Atualiza status para CONNECTED se estava diferente
    await prisma.mercadoLivreAccount.update({
      where: { id },
      data: {
        status: "CONNECTED",
        nickname: userData.nickname?.toUpperCase() || account.nickname,
      },
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
