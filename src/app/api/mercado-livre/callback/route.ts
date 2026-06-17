import { after, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { pbAdmin } from "@/lib/pb";
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");

  if (errorParam) {
    console.error("Erro no callback do Mercado Livre:", errorParam);
    return redirectWithClearedState("/dashboard?connect=error&msg=permissao_negada", request.url);
  }

  if (!code) {
    console.error("Código de autorização (code) ausente no callback.");
    return redirectWithClearedState("/dashboard?connect=error&msg=codigo_ausente", request.url);
  }

  try {
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

    const clientId = process.env.MERCADO_LIVRE_CLIENT_ID;
    const clientSecret = process.env.MERCADO_LIVRE_CLIENT_SECRET;
    const redirectUri = process.env.MERCADO_LIVRE_REDIRECT_URI;

    if (
      !clientId || !clientSecret || !redirectUri ||
      ["INSIRA_SEU_CLIENT_ID_AQUI", "seu_client_id"].includes(clientId) ||
      ["INSIRA_SEU_CLIENT_SECRET_AQUI", "seu_client_secret"].includes(clientSecret)
    ) {
      console.error("Credenciais do Mercado Livre não configuradas no .env.");
      return redirectWithClearedState("/dashboard?connect=error&msg=credenciais_ausentes", request.url);
    }

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
    const expiresIn = tokenData.expires_in || 21600;
    const meliUserIdStr = String(tokenData.user_id);

    if (!accessToken || !meliUserIdStr) {
      console.error("Resposta de token inválida do Mercado Livre:", tokenData);
      return redirectWithClearedState("/dashboard?connect=error&msg=resposta_invalida_token", request.url);
    }

    const expiresAt = new Date(Date.now() + expiresIn * 1000);

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

    console.log(`Persistindo conta ${nickname} (Meli ID: ${meliUserIdStr}) no PocketBase...`);
    
    const existingAccounts = await pbAdmin.collection("mercado_livre_accounts").getFullList({
      filter: pbAdmin.filter("organization = {:orgId} && meliUserId = {:meliUserIdStr}", { orgId: payload.orgId, meliUserIdStr })
    });
    const existingAccount = existingAccounts[0] || null;

    let existingToken = null;
    if (existingAccount) {
      const tokens = await pbAdmin.collection("oauth_tokens").getFullList({
        filter: pbAdmin.filter("account = {:id}", { id: existingAccount.id })
      });
      existingToken = tokens[0] || null;
    }

    const persistedRefreshToken = refreshToken || existingToken?.refreshToken || accessToken;

    if (!refreshToken && !existingToken?.refreshToken) {
      console.warn("[ML Callback] Mercado Livre nao retornou refresh_token; usando access_token como token temporario.");
    }

    let account;
    if (existingAccount) {
      account = await pbAdmin.collection("mercado_livre_accounts").update(existingAccount.id, {
        nickname: nickname,
        email: email,
        status: "CONNECTED",
        isActive: true,
        connectedAt: new Date().toISOString(),
        disconnectedAt: null,
        lastSyncError: null,
      });
    } else {
      account = await pbAdmin.collection("mercado_livre_accounts").create({
        organization: payload.orgId,
        meliUserId: meliUserIdStr,
        nickname: nickname,
        email: email,
        status: "CONNECTED",
        isActive: true,
        connectedAt: new Date().toISOString(),
      });
    }

    if (existingToken) {
      await pbAdmin.collection("oauth_tokens").update(existingToken.id, {
        accessToken: accessToken,
        refreshToken: persistedRefreshToken,
        expiresAt: expiresAt.toISOString(),
      });
    } else {
      await pbAdmin.collection("oauth_tokens").create({
        account: account.id,
        accessToken: accessToken,
        refreshToken: persistedRefreshToken,
        expiresAt: expiresAt.toISOString(),
      });
    }

    const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
    await pbAdmin.collection("audit_logs").create({
      organization: payload.orgId,
      user: payload.userId,
      mercadoLivreAccountId: account.id,
      action: "CONNECT_ACCOUNT",
      details: `Conta oficial vinculada com sucesso via OAuth2. Nickname: '${nickname}', ID Externo: ${meliUserIdStr}.`,
      ipAddress: ip,
    });

    console.log(`Conta ${nickname} conectada com sucesso! Disparando sincronização inicial...`);

    const freshAccount = account;

    after(async () => {
      try {
        const { MercadoLivreSyncService } = await import("@/services/mercado-livre-sync.service");
        await MercadoLivreSyncService.syncAccount(
          freshAccount.id,
          payload.orgId,
          payload.userId,
          ip
        );
      } catch (syncErr: unknown) {
        console.error(`[OAuth Callback] Erro na sincronização inicial da conta ${nickname}:`, syncErr);
      }
    });

    return redirectWithClearedState("/dashboard?connect=success&syncing=true", request.url);
  } catch (error: any) {
    console.error("Erro crítico no callback do Mercado Livre:", error);
    return redirectWithClearedState("/dashboard?connect=error&msg=erro_interno", request.url);
  }
}
