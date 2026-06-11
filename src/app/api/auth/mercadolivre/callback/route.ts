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

/**
 * GET /api/auth/mercadolivre/callback
 *
 * Callback oficial do OAuth2 do Mercado Livre.
 * URL configurada no DevCenter: https://sixties-rover-overcook.ngrok-free.dev/api/auth/mercadolivre/callback
 *
 * Fluxo:
 * 1. Recebe `code` e `state` do ML
 * 2. Troca `code` por access_token + refresh_token
 * 3. Chama /users/me para obter dados reais
 * 4. Upsert na MercadoLivreAccount (por organizationId + meliUserId)
 * 5. Upsert no OAuthToken
 * 6. Dispara sincronização inicial em background
 * 7. Redireciona para /configuracoes/contas-mercado-livre?connected=true
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  const redirectBase = "/configuracoes/contas-mercado-livre";

  // ── Erro retornado pelo ML (ex: usuário cancelou) ────────────────────────
  if (errorParam) {
    console.error("[ML Callback] Erro retornado pelo Mercado Livre:", errorParam, errorDescription);
    return redirectWithClearedState(
      `${redirectBase}?error=ml_denied&msg=${encodeURIComponent(errorDescription || errorParam)}`,
      request.url
    );
  }

  if (!code) {
    return redirectWithClearedState(`${redirectBase}?error=no_code`, request.url);
  }

  try {
    // ── 1. Valida sessão do SaaS Datex ───────────────────────────────────────
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("datex_session");
    if (!sessionCookie) {
      return redirectWithClearedState("/login?error=sessao_expirada", request.url);
    }

    const payload = await verifyToken(sessionCookie.value);
    if (!payload) {
      return redirectWithClearedState("/login?error=sessao_expirada", request.url);
    }

    const statePayload = state ? await verifyOAuthState(state) : null;
    if (!statePayload || statePayload.userId !== payload.userId || statePayload.orgId !== payload.orgId) {
      return redirectWithClearedState(`${redirectBase}?error=invalid_state`, request.url);
    }

    // ── 2. Carrega credenciais do .env ────────────────────────────────────────
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
      console.error("[ML Callback] Credenciais não configuradas no .env");
      return redirectWithClearedState(`${redirectBase}?error=config_missing`, request.url);
    }

    // ── 3. Troca code por access_token ────────────────────────────────────────
    console.log("[ML Callback] Trocando code por token...");
    const tokenResponse = await fetch("https://api.mercadolibre.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text().catch(() => "sem detalhes");
      console.error(`[ML Callback] Erro na troca de token [${tokenResponse.status}]:`, errText);
      return redirectWithClearedState(
        `${redirectBase}?error=token_exchange_failed&status=${tokenResponse.status}`,
        request.url
      );
    }

    const tokenData = await tokenResponse.json();
    const {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: expiresIn = 21600,
      user_id: meliUserIdRaw,
      scope,
      token_type: tokenType,
    } = tokenData;

    if (!accessToken || !meliUserIdRaw) {
      console.error("[ML Callback] Resposta de token inválida:", tokenData);
      return redirectWithClearedState(`${redirectBase}?error=invalid_token_response`, request.url);
    }

    const meliUserId = String(meliUserIdRaw);
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    // ── 4. Busca dados reais em /users/me ─────────────────────────────────────
    console.log(`[ML Callback] Buscando dados reais de /users/me para ID ${meliUserId}...`);
    let nickname = `ML_${meliUserId}`;
    let email: string | null = null;
    let siteId: string | null = null;
    let countryId: string | null = null;

    try {
      const userDetails = await MercadoLivreApiService.fetchAccountDetails(accessToken);
      if (userDetails?.nickname) nickname = userDetails.nickname.toUpperCase();
      if (userDetails?.email) email = userDetails.email.toLowerCase();
      // site_id e country_id podem estar disponíveis no payload
      const raw = userDetails as any;
      if (raw?.site_id) siteId = raw.site_id;
      if (raw?.address?.country_id) countryId = raw.address.country_id;
    } catch (detailsErr) {
      console.warn("[ML Callback] Não foi possível buscar /users/me, usando dados do token:", detailsErr);
    }

    // ── 5. Upsert na MercadoLivreAccount ─────────────────────────────────────
    console.log(`[ML Callback] Salvando conta ${nickname} (meliUserId: ${meliUserId})...`);
    let accountId: string | null = null;
    let isNew = false;

    const existingAccount = await prisma.mercadoLivreAccount.findUnique({
      where: {
        organizationId_meliUserId: {
          organizationId: payload.orgId,
          meliUserId,
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

    await prisma.$transaction(async (tx: any) => {
      let account;

      if (existingAccount) {
        // Atualiza conta existente
        account = await tx.mercadoLivreAccount.update({
          where: { id: existingAccount.id },
          data: {
            nickname,
            email,
            siteId,
            countryId,
            status: "CONNECTED",
            isActive: true,
            connectedAt: new Date(),
            disconnectedAt: null,
            lastSyncError: null,
          },
        });
        isNew = false;
      } else {
        // Cria nova conta
        account = await tx.mercadoLivreAccount.create({
          data: {
            organizationId: payload.orgId,
            meliUserId,
            nickname,
            email,
            siteId,
            countryId,
            status: "CONNECTED",
            isActive: true,
            connectedAt: new Date(),
          },
        });
        isNew = true;
      }

      accountId = account.id;

      // Upsert no OAuthToken
      await tx.oAuthToken.upsert({
        where: { mercadoLivreAccountId: account.id },
        create: {
          mercadoLivreAccountId: account.id,
          accessToken,
          refreshToken: persistedRefreshToken,
          expiresAt,
          scope: scope || null,
          tokenType: tokenType || "bearer",
        },
        update: {
          accessToken,
          refreshToken: persistedRefreshToken,
          expiresAt,
          scope: scope || null,
          tokenType: tokenType || "bearer",
        },
      });

      // Audit log
      const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
      await tx.auditLog.create({
        data: {
          organizationId: payload.orgId,
          userId: payload.userId,
          mercadoLivreAccountId: account.id,
          action: isNew ? "CONNECT_ACCOUNT" : "RECONNECT_ACCOUNT",
          details: `Conta ${isNew ? "conectada" : "reconectada"} via OAuth2 oficial. Nickname: '${nickname}', meliUserId: ${meliUserId}, site: ${siteId ?? "N/A"}.`,
          ipAddress: ip,
        },
      });
    });

    // ── 6. Sincronização inicial em background ────────────────────────────────
    if (!accountId) {
      throw new Error("Conta Mercado Livre não foi persistida.");
    }

    const finalAccountId = accountId;

    // Atualiza status para SYNCING
    await prisma.mercadoLivreAccount.update({
      where: { id: finalAccountId },
      data: { lastSyncStatus: "SYNCING" },
    });

    after(async () => {
      try {
        const { MercadoLivreSyncService } = await import("@/services/mercado-livre-sync.service");
        const report = await MercadoLivreSyncService.syncAccount(
          finalAccountId,
          payload.orgId,
          payload.userId
        );
        // Atualiza status final da sync
        await prisma.mercadoLivreAccount.update({
          where: { id: finalAccountId },
          data: {
            lastSyncAt: new Date(),
            lastSyncStatus: report.errors.length === 0 ? "SUCCESS" : "PARTIAL",
            lastSyncError: report.errors.length > 0 ? report.errors.join("; ") : null,
          },
        });
      } catch (syncErr: unknown) {
        const msg = syncErr instanceof Error ? syncErr.message : String(syncErr);
        console.error(`[ML Callback] Erro na sync inicial:`, msg);
        await prisma.mercadoLivreAccount.update({
          where: { id: finalAccountId },
          data: { lastSyncStatus: "FAILED", lastSyncError: msg },
        });
      }
    });

    // ── 7. Redireciona para a página de gerenciamento ─────────────────────────
    const successParam = isNew ? "connected=true" : "reconnected=true";
    console.log(`[ML Callback] ${isNew ? "Nova conta" : "Reconexão"} concluída: ${nickname}`);
    return redirectWithClearedState(
      `${redirectBase}?${successParam}&nickname=${encodeURIComponent(nickname)}`,
      request.url
    );

  } catch (error: any) {
    console.error("[ML Callback] Erro crítico:", error);
    return redirectWithClearedState(
      "/configuracoes/contas-mercado-livre?error=internal",
      request.url
    );
  }
}
