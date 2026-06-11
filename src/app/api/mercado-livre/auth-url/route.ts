import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createOAuthState, verifyToken } from "@/lib/auth";

/**
 * GET /api/mercado-livre/auth-url
 * Retorna a URL oficial de consentimento do Mercado Livre para iniciar o OAuth2.
 * Usa MERCADO_LIVRE_REDIRECT_URI do .env como redirect_uri.
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("datex_session");
    if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    const payload = await verifyToken(session.value);
    if (!payload) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });

    const clientId = process.env.MERCADO_LIVRE_CLIENT_ID;
    const redirectUri = process.env.MERCADO_LIVRE_REDIRECT_URI;

    if (!clientId || ["INSIRA_SEU_CLIENT_ID_AQUI", "seu_client_id"].includes(clientId)) {
      return NextResponse.json(
        { error: "MERCADO_LIVRE_CLIENT_ID não configurado no .env." },
        { status: 400 }
      );
    }
    if (!redirectUri) {
      return NextResponse.json(
        { error: "MERCADO_LIVRE_REDIRECT_URI não configurado no .env." },
        { status: 400 }
      );
    }

    const state = await createOAuthState({
      userId: payload.userId,
      orgId: payload.orgId,
    });
    const authUrl = new URL("https://auth.mercadolivre.com.br/authorization");
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", state);

    return NextResponse.json({ success: true, url: authUrl.toString() });
  } catch (error: any) {
    console.error("GET /api/mercado-livre/auth-url error:", error);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
