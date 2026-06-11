import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Lemos o cookie HttpOnly da sessão
  const sessionCookie = request.cookies.get("datex_session");

  if (!sessionCookie) {
    // Redireciona para login se não houver cookie de sessão
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Validamos o JWT
  const verified = await verifyToken(sessionCookie.value);

  if (!verified) {
    // Se o token for inválido ou expirado, deleta o cookie e redireciona para login
    const loginUrl = new URL("/login", request.url);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete("datex_session");
    return response;
  }

  return NextResponse.next();
}

// Configura quais caminhos do App Router acionam o proxy de proteção
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/anuncios/:path*",
    "/vendas/:path*",
    "/reputacao/:path*",
    "/publicidade/:path*",
    "/ads/:path*",
    "/promocoes/:path*",
    "/ia/:path*",
    "/configuracoes/:path*",
  ],
};
