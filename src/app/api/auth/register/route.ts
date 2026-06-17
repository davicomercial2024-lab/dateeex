import { NextResponse } from "next/server";
import { pbAdmin } from "@/lib/pb";
import { createToken } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

    // Authenticate admin to perform operations (you could also do this once globally, but it expires)
    await pbAdmin.admins.authWithPassword(process.env.PB_ADMIN_EMAIL || 'bbbaterias@bbdi.com.br', process.env.PB_ADMIN_PASS || 'diev1pn4753ikpf');

    // Verifica se o usuário já existe no PocketBase
    try {
      const existingUser = await pbAdmin.collection("users").getFirstListItem(`email="${normalizedEmail}"`);
      if (existingUser) {
        return NextResponse.json(
          { error: "Este e-mail já está cadastrado no Datex." },
          { status: 400 }
        );
      }
    } catch (e: any) {
      // getFirstListItem throws 404 if not found, which is what we want
      if (e.status !== 404) {
        throw e;
      }
    }

    // Cria o usuário no PocketBase
    const newUser = await pbAdmin.collection("users").create({
      email: normalizedEmail,
      password: password,
      passwordConfirm: password,
      name: name.trim(),
      emailVisibility: true,
    });

    // Cria a organização
    const newOrg = await pbAdmin.collection("organizations").create({
      name: company.trim(),
      plan: "FREE",
    });

    // Associa o usuário à organização como ADMIN
    await pbAdmin.collection("organization_members").create({
      organization: newOrg.id,
      user: newUser.id,
      role: "ADMIN",
    });

    // Atualiza o currentOrganizationId do usuário
    await pbAdmin.collection("users").update(newUser.id, {
      currentOrganizationId: newOrg.id,
    });

    // Cria o token de sessão JWT customizado do Datex
    const token = await createToken({ userId: newUser.id, orgId: newOrg.id });

    const response = NextResponse.json(
      { success: true, user: { name: newUser.name, email: newUser.email } },
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
  } catch (error: any) {
    console.error("Register Error:", error?.response || error);
    return NextResponse.json(
      { error: "Falha interna ao criar conta. Tente novamente." },
      { status: 500 }
    );
  }
}
