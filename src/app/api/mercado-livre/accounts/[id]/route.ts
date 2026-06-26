import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { pbAdmin } from "@/lib/pb";
import { verifyToken } from "@/lib/auth";
import { MercadoLivreBackgroundSyncService } from "@/services/mercado-livre-background-sync.service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = { params: Promise<{ id: string }> };

async function authenticateRequest() {
  const cookieStore = await cookies();
  const session = cookieStore.get("datex_session");
  if (!session) return { error: "Nao autenticado.", status: 401 as const };

  const payload = await verifyToken(session.value);
  if (!payload) return { error: "Sessao expirada.", status: 401 as const };

  await pbAdmin.admins.authWithPassword(
    process.env.PB_ADMIN_EMAIL as string,
    process.env.PB_ADMIN_PASS as string
  );

  return { payload };
}

async function deleteAllFromCollection(collection: string, filter: string) {
  try {
    const records = await pbAdmin.collection(collection).getFullList({ filter, requestKey: null });
    for (const record of records) {
      await pbAdmin.collection(collection).delete(record.id, { requestKey: null });
    }
    return records.length;
  } catch (error: any) {
    if (error?.status === 404) return 0;
    throw error;
  }
}

async function deleteByIds(collection: string, field: string, ids: string[]) {
  let deleted = 0;
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    if (chunk.length === 0) continue;
    const filter = chunk.map((id) => `${field}="${id}"`).join(" || ");
    deleted += await deleteAllFromCollection(collection, filter);
  }
  return deleted;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const auth = await authenticateRequest();
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    try {
      await pbAdmin.collection("mercado_livre_accounts").getFirstListItem(
        `id="${id}" && organization="${auth.payload.orgId}" && isActive=true`,
        { requestKey: null }
      );
    } catch {
      return NextResponse.json({ error: "Conta nao encontrada." }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    if (typeof body.nicknameCustom === "string") {
      const trimmed = body.nicknameCustom.trim();
      updateData.nicknameCustom = trimmed === "" ? null : trimmed;
    }

    if (body.isDefault === true) {
      const others = await pbAdmin.collection("mercado_livre_accounts").getFullList({
        filter: `organization="${auth.payload.orgId}" && isDefault=true && id!="${id}"`,
        requestKey: null,
      });
      for (const other of others) {
        await pbAdmin.collection("mercado_livre_accounts").update(other.id, { isDefault: false }, { requestKey: null });
      }
      updateData.isDefault = true;
    } else if (body.isDefault === false) {
      updateData.isDefault = false;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "Nenhum campo valido para atualizar." }, { status: 400 });
    }

    const updated = await pbAdmin.collection("mercado_livre_accounts").update(id, updateData, { requestKey: null });

    return NextResponse.json({
      success: true,
      account: { ...updated, displayName: updated.nicknameCustom || updated.nickname },
    });
  } catch (err: any) {
    console.error("PATCH /api/mercado-livre/accounts/[id] error:", err?.response || err);
    return NextResponse.json({ error: err?.message || "Erro interno ao atualizar a conta." }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const auth = await authenticateRequest();
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id } = await params;

    let account: any;
    try {
      account = await pbAdmin.collection("mercado_livre_accounts").getFirstListItem(
        `id="${id}" && organization="${auth.payload.orgId}"`,
        { requestKey: null }
      );
    } catch {
      return NextResponse.json({ error: "Conta nao encontrada." }, { status: 404 });
    }

    const cancelledBackgroundSync = MercadoLivreBackgroundSyncService.cancel(id);
    const disconnectedAt = new Date().toISOString();

    const deletedTokens = await deleteAllFromCollection("oauth_tokens", `account="${id}"`).catch((error) => {
      console.warn("Failed to remove oauth tokens while disconnecting ML account:", error);
      return 0;
    });

    await pbAdmin.collection("mercado_livre_accounts").update(id, {
      isActive: false,
      status: "DISCONNECTED",
      disconnectedAt,
      lastSyncError: "",
      isDefault: false,
    }, { requestKey: null });

    const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
    await pbAdmin.collection("audit_logs").create({
      organization: auth.payload.orgId,
      user: auth.payload.userId,
      action: "DISCONNECT_ACCOUNT",
      details: `Conta '${account.nickname}' (meliUserId: ${account.meliUserId}) desconectada. Historico preservado. Tokens removidos: ${deletedTokens}. Sync cancelado: ${cancelledBackgroundSync}.`,
      ipAddress: ip,
    }, { requestKey: null }).catch((error) => {
      console.warn("Failed to create disconnect audit log:", error);
    });

    return NextResponse.json({
      success: true,
      message: "Conta desconectada com sucesso. O historico foi preservado.",
      disconnectedAt,
      deletedTokens,
      cancelledBackgroundSync,
    });
  } catch (err: any) {
    console.error("DELETE /api/mercado-livre/accounts/[id] error:", err?.response || err);
    return NextResponse.json({ error: err?.message || "Erro interno ao excluir a conta." }, { status: 500 });
  }
}
