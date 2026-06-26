import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { pbAdmin } from "@/lib/pb";
import { MercadoLivreBackgroundSyncService } from "@/services/mercado-livre-background-sync.service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get("datex_session")?.value;
  if (!token) return null;
  return verifyToken(token);
}

async function getAccounts(accountId: string | undefined, orgId: string) {
  await pbAdmin.admins.authWithPassword(
    process.env.PB_ADMIN_EMAIL as string,
    process.env.PB_ADMIN_PASS as string
  );

  if (accountId && accountId !== "all") {
    const account = await pbAdmin
      .collection("mercado_livre_accounts")
      .getFirstListItem(`id="${accountId}" && organization="${orgId}"`, { requestKey: null });
    return [account];
  }

  return pbAdmin.collection("mercado_livre_accounts").getFullList({
    filter: `organization="${orgId}" && isActive=true && status!="DISCONNECTED"`,
    sort: "-isDefault,-updated",
    requestKey: null,
  });
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const accountId = body.accountId as string | undefined;
    const accounts = await getAccounts(accountId, session.orgId);

    if (accounts.length === 0) {
      return NextResponse.json({ success: true, reports: [], message: "Nenhuma conta ativa encontrada." });
    }

    const reports: Array<{
      accountId: string;
      nickname?: string;
      started: boolean;
      alreadyRunning: boolean;
    }> = [];

    for (const account of accounts) {
      const result = MercadoLivreBackgroundSyncService.start(account.id, session.orgId);
      reports.push({
        accountId: account.id,
        nickname: account.nickname,
        started: result.started,
        alreadyRunning: result.alreadyRunning,
      });
    }

    return NextResponse.json({
      success: true,
      mode: "background",
      reports,
      message: "Sincronizacao iniciada em segundo plano.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha na sincronizacao.";
    console.error("POST /api/mercado-livre/sync error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
