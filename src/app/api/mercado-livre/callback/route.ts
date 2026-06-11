import { after, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyOAuthState, verifyToken } from "@/lib/auth";
import { MercadoLivreApiService } from "@/services/mercado-livre-api.service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getPublicUrl(path: string, requestUrl: string) {
  const redirectUri = process.env.MERCADO_LIVRE_REDIRECT_URI;

  if (redirectUri) {
    return new URL(path, new URL(redirectUri).origin);
  }

  return new URL(path, requestUrl);
}

function redirectWithClearedState(path: string, requestUrl: string) {
  const response = NextResponse.redirect(getPublicUrl(path, requestUrl));
  return response;
}

// GET /api/mercado-livre/callback - Callback oficial do OAuth2 do Mercado Livre
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");

  // Se houver erro retornado pelo próprio Mercado Livre (ex: usuário cancelou a autorização)
  if (errorParam) {
    console.error("Erro no callback do Mercado Livre:", errorParam);
    return redirectWithClearedState(
      "/dashboard?connect=error&msg=permissao_negada",
      request.url
    );
  }

  if (!code) {
    console.error("Código de autorização (code) ausente no callback.");
    return redirectWithClearedState("/dashboard?connect=error&msg=codigo_ausente", request.url);
  }

  try {
    // 1. Validar a sessão do usuário no SaaS Datex
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("datex_session");
    if (!sessionCookie) {
      console.warn("Usuário não autenticado tentando acessar o callback.");
      return redirectWithClearedState("/login?error=sessao_expirada", request.url);
    }

    const payload = await verifyToken(sessionCookie.value);
    if (!payload) {
      console.warn("Sessão inválida no callback.");
      return redirectWithClearedState("/login?error=sessao_expirada", request.url);
    }

    const statePayload = state ? await verifyOAuthState(state) : null;
    if (!statePayload || statePayload.userId !== payload.userId || statePayload.orgId !== payload.orgId) {
      return redirectWithClearedState("/dashboard?connect=error&msg=estado_invalido", request.url);
    }

    // 2. Carregar credenciais do .env
    const clientId = process.env.MERCADO_LIVRE_CLIENT_ID;
    const clientSecret = process.env.MERCADO_LIVRE_CLIENT_SECRET;
    const redirectUri = process.env.MERCADO_LIVRE_REDIRECT_URI;

    if (
      !clientId ||
      !clientSecret ||
      !redirectUri ||
      ["INSIRA_SEU_CLIENT_ID_AQUI", "seu_client_id"].includes(clientId) ||
      ["INSIRA_SEU_CLIENT_SECRET_AQUI", "seu_client_secret"].includes(clientSecret)
    ) {
      console.error("Credenciais do Mercado Livre não configuradas no .env.");
      return redirectWithClearedState("/dashboard?connect=error&msg=credenciais_ausentes", request.url);
    }

    // 3. Trocar o código de autorização pelo token oficial (POST /oauth/token)
    const tokenUrl = "https://api.mercadolibre.com/oauth/token";
    const bodyParams = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
      redirect_uri: redirectUri,
    });

    console.log("Trocando código de autorização por token oficial do Mercado Livre...");
    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: bodyParams.toString(),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error(`Erro ao trocar token [${tokenResponse.status}]:`, errorText);
      return redirectWithClearedState("/dashboard?connect=error&msg=troca_token_falhou", request.url);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = tokenData.expires_in || 21600; // Padrão 6 horas
    const meliUserIdStr = String(tokenData.user_id);

    if (!accessToken || !meliUserIdStr) {
      console.error("Resposta de token inválida do Mercado Livre:", tokenData);
      return redirectWithClearedState("/dashboard?connect=error&msg=resposta_invalida_token", request.url);
    }

    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    // 4. Obter detalhes da conta vinculada (Nickname e Email do vendedor)
    console.log(`Buscando detalhes do usuário Meli ID ${meliUserIdStr}...`);
    let nickname = `ML_${meliUserIdStr}`;
    let email = `${nickname.toLowerCase()}@mercadolivre.com.br`;

    try {
      const accountDetails = await MercadoLivreApiService.fetchAccountDetails(accessToken);
      if (accountDetails && accountDetails.nickname) {
        nickname = accountDetails.nickname.toUpperCase();
      }
      if (accountDetails && accountDetails.email) {
        email = accountDetails.email.toLowerCase();
      }
    } catch (detailsError) {
      console.warn("Não foi possível obter os detalhes do usuário via API. Usando valores padrão.", detailsError);
    }

    // 5. Salvar/Atualizar a conta e o token no banco de dados em uma transação Prisma
    console.log(`Persistindo conta ${nickname} (Meli ID: ${meliUserIdStr}) no PostgreSQL...`);
    
    await prisma.$transaction(async (tx) => {
      // Upsert na conta MercadoLivreAccount
      const existingAccount = await tx.mercadoLivreAccount.findUnique({
        where: {
          organizationId_meliUserId: {
            organizationId: payload.orgId,
            meliUserId: meliUserIdStr,
          },
        },
        include: {
          token: true,
        },
      });

      const persistedRefreshToken = refreshToken || existingAccount?.token?.refreshToken || accessToken;

      if (!refreshToken && !existingAccount?.token?.refreshToken) {
        console.warn("[ML Callback] Mercado Livre nao retornou refresh_token; usando access_token como token temporario.");
      }

      const account = existingAccount
        ? await tx.mercadoLivreAccount.update({
          where: { id: existingAccount.id },
          data: {
            nickname: nickname,
            email: email,
            status: "CONNECTED",
            isActive: true,
            connectedAt: new Date(),
            disconnectedAt: null,
            lastSyncError: null,
          },
        })
        : await tx.mercadoLivreAccount.create({
          data: {
            organizationId: payload.orgId,
            meliUserId: meliUserIdStr,
            nickname: nickname,
            email: email,
            status: "CONNECTED",
            isActive: true,
            connectedAt: new Date(),
          },
        });

      // Upsert no token OAuthToken
      await tx.oAuthToken.upsert({
        where: { mercadoLivreAccountId: account.id },
        create: {
          mercadoLivreAccountId: account.id,
          accessToken: accessToken,
          refreshToken: persistedRefreshToken,
          expiresAt: expiresAt,
        },
        update: {
          accessToken: accessToken,
          refreshToken: persistedRefreshToken,
          expiresAt: expiresAt,
        },
      });

      // Gravar registro na trilha de auditoria (AuditLog)
      const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
      await tx.auditLog.create({
        data: {
          organizationId: payload.orgId,
          userId: payload.userId,
          mercadoLivreAccountId: account.id,
          action: "CONNECT_ACCOUNT",
          details: `Conta oficial vinculada com sucesso via OAuth2. Nickname: '${nickname}', ID Externo: ${meliUserIdStr}.`,
          ipAddress: ip,
        },
      });
    });

    console.log(`Conta ${nickname} conectada com sucesso! Disparando sincronização inicial...`);

    // Busca o account ID recém-criado/atualizado para disparar sync inicial
    const freshAccount = await prisma.mercadoLivreAccount.findUnique({
      where: {
        organizationId_meliUserId: {
          organizationId: payload.orgId,
          meliUserId: meliUserIdStr,
        },
      },
    });

    // Dispara sincronização inicial no ciclo after() do Next.
    if (freshAccount) {
      after(async () => {
        try {
          const { MercadoLivreSyncService } = await import("@/services/mercado-livre-sync.service");
          await MercadoLivreSyncService.syncAccount(
            freshAccount.id,
            payload.orgId,
            payload.userId,
            request.headers.get("x-forwarded-for") || "127.0.0.1"
          );
        } catch (syncErr: unknown) {
          console.error(`[OAuth Callback] Erro na sincronização inicial da conta ${nickname}:`, syncErr);
        }
      });
    }

    // Redireciona o usuário para o dashboard
    return redirectWithClearedState("/dashboard?connect=success&syncing=true", request.url);
  } catch (error: any) {
    console.error("Erro crítico no callback do Mercado Livre:", error);
    return redirectWithClearedState("/dashboard?connect=error&msg=erro_interno", request.url);
  }
}
