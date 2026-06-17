import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { pbAdmin } from "@/lib/pb";
import { verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("datex_session");
  if (!sessionCookie) return null;
  const payload = await verifyToken(sessionCookie.value);
  if (!payload) return null;

  await pbAdmin.admins.authWithPassword(process.env.PB_ADMIN_EMAIL as string, process.env.PB_ADMIN_PASS as string);

  try {
    const membership = await pbAdmin.collection("organization_members").getFirstListItem(
      `organization="${payload.orgId}" && user="${payload.userId}"`
    );
    if (membership.role !== "ADMIN") return null;
    return { userId: payload.userId, orgId: payload.orgId };
  } catch (e) {
    return null;
  }
}

export async function GET() {
  const auth = await verifyAdmin();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const members = await pbAdmin.collection("organization_members").getFullList({
      filter: `organization="${auth.orgId}"`,
      expand: "user",
      sort: "-created",
    });

    // Mapeia para o formato esperado pelo frontend
    const mappedMembers = members.map(m => ({
      id: m.id,
      role: m.role,
      user: {
        id: m.expand?.user?.id,
        name: m.expand?.user?.name,
        email: m.expand?.user?.email,
        createdAt: m.created,
      }
    }));

    return NextResponse.json({ success: true, data: mappedMembers });
  } catch (error) {
    console.error("List Users Error:", error);
    return NextResponse.json({ error: "Erro interno ao listar usuários." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await verifyAdmin();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { name, email, password, role } = body;

    if (!name || !email || !password || !role) {
      return NextResponse.json({ error: "Campos obrigatórios faltando." }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "A senha deve conter no mínimo 6 caracteres." }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    let user;
    try {
      user = await pbAdmin.collection("users").getFirstListItem(`email="${normalizedEmail}"`);
    } catch (e) {
      // Usuário não existe, criar
      user = await pbAdmin.collection("users").create({
        email: normalizedEmail,
        password: password,
        passwordConfirm: password,
        name: name.trim(),
        emailVisibility: true,
      });
    }

    try {
      await pbAdmin.collection("organization_members").getFirstListItem(
        `organization="${auth.orgId}" && user="${user.id}"`
      );
      return NextResponse.json({ error: "Usuário já pertence à organização." }, { status: 400 });
    } catch (e) {
      // Membership doesn't exist, proceed to create
    }

    const membership = await pbAdmin.collection("organization_members").create({
      organization: auth.orgId,
      user: user.id,
      role: role,
    });

    const mappedMembership = {
      id: membership.id,
      role: membership.role,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: membership.created,
      }
    };

    return NextResponse.json({ success: true, data: mappedMembership }, { status: 201 });
  } catch (error: any) {
    console.error("Create User Error:", error?.response || error);
    return NextResponse.json({ error: "Erro interno ao criar usuário." }, { status: 500 });
  }
}
