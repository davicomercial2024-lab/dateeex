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

  await pbAdmin.admins.authWithPassword(process.env.PB_ADMIN_EMAIL || 'bbbaterias@bbdi.com.br', process.env.PB_ADMIN_PASS || 'diev1pn4753ikpf');

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

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await verifyAdmin();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = await context.params;
  const targetUserId = params.id;

  try {
    const body = await request.json();
    const { name, email, password, role } = body;

    let membership;
    try {
      membership = await pbAdmin.collection("organization_members").getFirstListItem(
        `organization="${auth.orgId}" && user="${targetUserId}"`
      );
    } catch (e) {
      return NextResponse.json({ error: "Usuário não encontrado na organização." }, { status: 404 });
    }

    if (auth.userId === targetUserId && role && role !== "ADMIN") {
      return NextResponse.json({ error: "Você não pode remover seus próprios privilégios de administrador." }, { status: 400 });
    }

    if (name || email || password) {
      const updateData: any = {};
      if (name) updateData.name = name.trim();
      if (email) updateData.email = email.toLowerCase().trim();
      if (password) {
        updateData.password = password;
        updateData.passwordConfirm = password;
      }

      await pbAdmin.collection("users").update(targetUserId, updateData);
    }

    if (role && role !== membership.role) {
      await pbAdmin.collection("organization_members").update(membership.id, { role });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Update User Error:", error?.response || error);
    return NextResponse.json({ error: "Erro interno ao atualizar usuário." }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await verifyAdmin();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = await context.params;
  const targetUserId = params.id;

  if (auth.userId === targetUserId) {
    return NextResponse.json({ error: "Você não pode excluir sua própria conta por aqui." }, { status: 400 });
  }

  try {
    let membership;
    try {
      membership = await pbAdmin.collection("organization_members").getFirstListItem(
        `organization="${auth.orgId}" && user="${targetUserId}"`
      );
    } catch (e) {
      return NextResponse.json({ error: "Usuário não encontrado na organização." }, { status: 404 });
    }

    // Deleta o vínculo
    await pbAdmin.collection("organization_members").delete(membership.id);

    // Verifica se ele pertence a outras organizações
    const otherMemberships = await pbAdmin.collection("organization_members").getFullList({
      filter: `user="${targetUserId}"`
    });

    if (otherMemberships.length === 0) {
      // Deleta o usuário permanentemente se não houver vínculos
      await pbAdmin.collection("users").delete(targetUserId);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Delete User Error:", error?.response || error);
    return NextResponse.json({ error: "Erro interno ao excluir usuário." }, { status: 500 });
  }
}
