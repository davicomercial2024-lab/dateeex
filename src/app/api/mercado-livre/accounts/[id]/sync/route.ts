import { after, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { pbAdmin } from "@/lib/pb";
import { verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("datex_session");
    if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    const payload = await verifyToken(session.value);
    if (!payload) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });

    const { id } = await params;

    const account = await pbAdmin.collection("mercado_livre_accounts").getOne(id).catch(() => null);

    if (!account || account.organization !== payload.orgId || !account.isActive) {
      return NextResponse.json({ error: "Conta não encontrada ou inativa." }, { status: 404 });
    }

    const tokens = await pbAdmin.collection("oauth_tokens").getFullList({
      filter: pbAdmin.filter("account = {:id}", { id: account.id }),
    });
    const token = tokens[0] || null;

    if (!token) return NextResponse.json({ error: "Conta sem token OAuth. Reconecte via OAuth." }, { status: 400 });
    
    if (new Date(token.expiresAt) < new Date() && token.accessToken === token.refreshToken) {
      return NextResponse.json({ error: "Token expirado. Reconecte a conta via OAuth." }, { status: 400 });
    }
    
    if (account.lastSyncStatus === "SYNCING") {
      return NextResponse.json({ success: true, message: "Sincronização já está em andamento." }, { status: 200 });
    }

    await pbAdmin.collection("mercado_livre_accounts").update(id, {
      lastSyncStatus: "SYNCING", lastSyncProgress: 0, lastSyncError: null
    });

    try {
      const { MercadoLivreSyncService } = await import("@/services/mercado-livre-sync.service");
      const report = await MercadoLivreSyncService.syncAccount(
        id,
        payload.orgId,
        payload.userId,
        undefined,
        async (progress) => {
          await pbAdmin.collection("mercado_livre_accounts").update(id, {
            lastSyncProgress: progress
          });
        }
      );
      await pbAdmin.collection("mercado_livre_accounts").update(id, {
        lastSyncAt: new Date().toISOString(),
        lastSyncStatus: report.errors.length === 0 ? "SUCCESS" : "PARTIAL",
        lastSyncProgress: 100,
        lastSyncError: report.errors.length > 0 ? report.errors.join("; ") : null,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await pbAdmin.collection("mercado_livre_accounts").update(id, {
        lastSyncStatus: "FAILED", lastSyncError: msg, lastSyncAt: new Date().toISOString(), lastSyncProgress: 100
      });
    }

    return NextResponse.json(
      { success: true, message: "Sincronização iniciada. Você pode continuar usando o sistema." },
      { status: 202 }
    );
  } catch (err: any) {
    console.error("POST .../sync error:", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
