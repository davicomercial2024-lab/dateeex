import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
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

    // Busca o usuário incluindo suas organizações vinculadas
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        memberships: {
          include: {
            organization: true,
          },
        },
      },
    });

    if (!user) {
      // Mensagem genérica por questões de segurança
      return NextResponse.json(
        { error: "Credenciais inválidas. Verifique seu e-mail e senha." },
        { status: 401 }
      );
    }

    // Compara o hash da senha
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Credenciais inválidas. Verifique seu e-mail e senha." },
        { status: 401 }
      );
    }

    // Obtém a organização ativa (a primeira onde ele é membro)
    const activeMembership = user.memberships[0];

    if (!activeMembership) {
      return NextResponse.json(
        { error: "Seu usuário não está associado a nenhuma organização ativa." },
        { status: 403 }
      );
    }

    // Cria o token de sessão JWT
    const token = await createToken({
      userId: user.id,
      orgId: activeMembership.organizationId,
    });

    // Injeta o cookie seguro HTTP-only na resposta
    const response = NextResponse.json(
      {
        success: true,
        user: { name: user.name, email: user.email },
        organization: activeMembership.organization.name,
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
    console.error("Login Error:", error);
    return NextResponse.json(
      { error: "Falha interna ao processar login." },
      { status: 500 }
    );
  }
}
