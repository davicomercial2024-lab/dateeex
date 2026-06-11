import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createToken } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export async function POST(request: Request) {
  try {
    const { name, company, email, password } = await request.json();

    if (!name || !company || !email || !password) {
      return NextResponse.json(
        { error: "Por favor, preencha todos os campos obrigatórios." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "A senha deve conter no mínimo 6 caracteres." },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Verifica se o usuário já existe
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Este e-mail já está cadastrado no Datex." },
        { status: 400 }
      );
    }

    // Criptografa a senha do usuário
    const passwordHash = await bcrypt.hash(password, 10);

    // Criação atômica no banco via transação (User -> Org -> Member ADMIN)
    const { user, organization } = await prisma.$transaction(async (tx: TransactionClient) => {
      const newUser = await tx.user.create({
        data: {
          name: name.trim(),
          email: normalizedEmail,
          passwordHash,
        },
      });

      const newOrg = await tx.organization.create({
        data: {
          name: company.trim(),
        },
      });

      await tx.organizationMember.create({
        data: {
          organizationId: newOrg.id,
          userId: newUser.id,
          role: "ADMIN", // Primeiro usuário é o administrador do tenant
        },
      });

      return { user: newUser, organization: newOrg };
    });

    // Cria o token de sessão JWT
    const token = await createToken({ userId: user.id, orgId: organization.id });

    // Prepara a resposta com cookie HTTP-only
    const response = NextResponse.json(
      { success: true, user: { name: user.name, email: user.email } },
      { status: 201 }
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
  } catch (error) {
    console.error("Register Error:", error);
    return NextResponse.json(
      { error: "Falha interna ao criar conta. Tente novamente." },
      { status: 500 }
    );
  }
}
