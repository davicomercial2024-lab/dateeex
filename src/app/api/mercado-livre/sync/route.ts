import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { pbAdmin } from "@/lib/pb";
import { verifyToken } from "@/lib/auth";
import { MercadoLivreSyncService, SyncReport } from "@/services/mercado-livre-sync.service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("datex_session");

    if (!sessionCookie) {
      return NextResponse.json({ error: "Sessao nao encontrada." }, { status: 401 });
    }

    const payload = await verifyToken(sessionCookie.value);

    if (!payload) {
      return NextResponse.json({ error: "Sessao invalida ou expirada." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { accountId } = body;

    if (!accountId) {
      return NextResponse.json({ error: "O parametro accountId e obrigatorio." }, { status: 400 });
    }

    const ipAddress = req.headers.get("x-forwarded-for") || "127.0.0.1";
    const reports: SyncReport[] = [];

    if (accountId === "all") {
      const accounts = await pbAdmin.collection("mercado_livre_accounts").getFullList({
        filter: pbAdmin.filter("organization = {:orgId} && isActive = true && status = 'CONNECTED'", { orgId: payload.orgId }),
      });

      if (accounts.length === 0) {
        return NextResponse.json({
          success: true,
          message: "Nenhuma conta vinculada para sincronizar.",
          reports: [],
        });
      }

      for (const account of accounts) {
        await pbAdmin.collection("mercado_livre_accounts").update(account.id, {
          lastSyncStatus: "SYNCING", lastSyncProgress: 0, lastSyncError: null
        });

        const report = await MercadoLivreSyncService.syncAccount(
          account.id,
          payload.orgId,
          payload.userId,
          ipAddress,
          async (progress) => {
            await pbAdmin.collection("mercado_livre_accounts").update(account.id, { lastSyncProgress: progress });
          }
        );

        await pbAdmin.collection("mercado_livre_accounts").update(account.id, {
          lastSyncAt: new Date().toISOString(),
          lastSyncStatus: report.errors.length === 0 ? "SUCCESS" : "PARTIAL",
          lastSyncProgress: 100,
          lastSyncError: report.errors.length > 0 ? report.errors.join("; ") : null,
        });
        reports.push(report);
      }
    } else {
      await pbAdmin.collection("mercado_livre_accounts").update(accountId, {
        lastSyncStatus: "SYNCING", lastSyncProgress: 0, lastSyncError: null
      });

      const report = await MercadoLivreSyncService.syncAccount(
        accountId,
        payload.orgId,
        payload.userId,
        ipAddress,
        async (progress) => {
          await pbAdmin.collection("mercado_livre_accounts").update(accountId, { lastSyncProgress: progress });
        }
      );

      await pbAdmin.collection("mercado_livre_accounts").update(accountId, {
        lastSyncAt: new Date().toISOString(),
        lastSyncStatus: report.errors.length === 0 ? "SUCCESS" : "PARTIAL",
        lastSyncProgress: 100,
        lastSyncError: report.errors.length > 0 ? report.errors.join("; ") : null,
      });
      reports.push(report);
    }

    const successCount = reports.filter((r) => r.success).length;
    const hasFailures = reports.some((r) => !r.success);

    return NextResponse.json({
      success: successCount > 0 || reports.length === 0,
      partial: hasFailures && successCount > 0,
      reports,
    });
  } catch (error: any) {
    console.error("POST sync error:", error);
    return NextResponse.json({ error: "Erro interno ao processar sincronizacao." }, { status: 500 });
  }
}
