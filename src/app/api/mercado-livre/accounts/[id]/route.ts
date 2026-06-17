import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { pbAdmin } from "@/lib/pb";
import { verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("datex_session");
    if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    const payload = await verifyToken(session.value);
    if (!payload) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });

    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    await pbAdmin.admins.authWithPassword(process.env.PB_ADMIN_EMAIL || 'bbbaterias@bbdi.com.br', process.env.PB_ADMIN_PASS || 'diev1pn4753ikpf');

    let account;
    try {
      account = await pbAdmin.collection("mercado_livre_accounts").getFirstListItem(
        `id="${id}" && organization="${payload.orgId}" && isActive=true`
      );
    } catch (e) {
      return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    if (typeof body.nicknameCustom === "string") {
      const trimmed = body.nicknameCustom.trim();
      updateData.nicknameCustom = trimmed === "" ? null : trimmed;
    }

    if (body.isDefault === true) {
      // Find other defaults
      const others = await pbAdmin.collection("mercado_livre_accounts").getFullList({
        filter: `organization="${payload.orgId}" && isDefault=true && id!="${id}"`
      });
      for (const other of others) {
        await pbAdmin.collection("mercado_livre_accounts").update(other.id, { isDefault: false });
      }
      updateData.isDefault = true;
    } else if (body.isDefault === false) {
      updateData.isDefault = false;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "Nenhum campo válido para atualizar." }, { status: 400 });
    }

    const updated = await pbAdmin.collection("mercado_livre_accounts").update(id, updateData);

    return NextResponse.json({
      success: true,
      account: { ...updated, displayName: updated.nicknameCustom || updated.nickname },
    });
  } catch (err: any) {
    console.error("PATCH /api/mercado-livre/accounts/[id] error:", err?.response || err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("datex_session");
    if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    const payload = await verifyToken(session.value);
    if (!payload) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });

    const { id } = await params;

    await pbAdmin.admins.authWithPassword(process.env.PB_ADMIN_EMAIL || 'bbbaterias@bbdi.com.br', process.env.PB_ADMIN_PASS || 'diev1pn4753ikpf');

    let account;
    try {
      account = await pbAdmin.collection("mercado_livre_accounts").getFirstListItem(
        `id="${id}" && organization="${payload.orgId}"`
      );
    } catch (e) {
      return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });
    }

    // Hard delete
    await pbAdmin.collection("mercado_livre_accounts").delete(id);

    // Audit log
    const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
    await pbAdmin.collection("audit_logs").create({
      organization: payload.orgId,
      user: payload.userId,
      action: "DISCONNECT_ACCOUNT",
      details: `Conta '${account.nickname}' (meliUserId: ${account.meliUserId}) desconectada e excluída permanentemente.`,
      ipAddress: ip,
    });

    return NextResponse.json({ success: true, message: "Conta e todos os dados associados foram excluídos com sucesso." });
  } catch (err: any) {
    console.error("DELETE /api/mercado-livre/accounts/[id] error:", err?.response || err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
