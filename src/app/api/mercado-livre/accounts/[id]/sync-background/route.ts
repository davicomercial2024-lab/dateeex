import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { pbAdmin } from "@/lib/pb";
import { MercadoLivreBackgroundSyncService } from "@/services/mercado-livre-background-sync.service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("datex_session")?.value;
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = await verifyToken(session);
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Missing account ID" }, { status: 400 });

    await pbAdmin.admins.authWithPassword(
      process.env.PB_ADMIN_EMAIL as string,
      process.env.PB_ADMIN_PASS as string
    );

    await pbAdmin
      .collection("mercado_livre_accounts")
      .getFirstListItem(`id="${id}" && organization="${payload.orgId}"`, { requestKey: null });

    const result = MercadoLivreBackgroundSyncService.start(id, payload.orgId);

    return NextResponse.json({
      success: true,
      mode: "background",
      ...result,
      message: result.alreadyRunning
        ? "Sincronizacao ja esta em andamento."
        : "Sincronizacao iniciada em segundo plano.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao iniciar sincronizacao.";
    console.error("POST /api/mercado-livre/accounts/[id]/sync-background error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
