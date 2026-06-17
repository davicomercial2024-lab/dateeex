import { NextResponse } from "next/server";
import { getPb, pbAdmin } from "@/lib/pb";
import { createToken } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Por favor, preencha o e-mail e a senha." },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Instancia um PB limpo para testar o login
    const pb = getPb();
    let authData;
    try {
      authData = await pb.collection("users").authWithPassword(normalizedEmail, password);
    } catch (e) {
      return NextResponse.json(
        { error: "Credenciais inválidas. Verifique seu e-mail e senha." },
        { status: 401 }
      );
    }

    const user = authData.record;

    // Autentica admin para buscar relacionamentos seguros (organization_members)
    await pbAdmin.admins.authWithPassword(process.env.PB_ADMIN_EMAIL as string, process.env.PB_ADMIN_PASS as string);

    // Obtém a organização ativa do usuário
    let activeMembership;
    try {
      const memberships = await pbAdmin.collection("organization_members").getFullList({
        filter: `user="${user.id}"`,
        expand: "organization",
      });
      activeMembership = memberships[0];
    } catch (e) {}

    if (!activeMembership) {
      return NextResponse.json(
        { error: "Seu usuário não está associado a nenhuma organização ativa." },
        { status: 403 }
      );
    }

    // Cria o token de sessão JWT
    const token = await createToken({
      userId: user.id,
      orgId: activeMembership.organization,
    });

    const response = NextResponse.json(
      {
        success: true,
        user: { name: user.name, email: user.email },
        organization: activeMembership.expand?.organization?.name || "Organização",
      },
      { status: 200 }
    );

    response.cookies.set({
      name: "datex_session",
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 dias
      path: "/",
    });

    return response;
  } catch (error: any) {
    console.error("Login Error:", error?.response || error);
    return NextResponse.json(
      { error: "Falha interna ao processar login." },
      { status: 500 }
    );
  }
}
