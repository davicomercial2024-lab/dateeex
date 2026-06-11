import { after, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/mercado-livre/accounts/[id]/sync
 * Dispara sincronização pontual de uma conta específica.
 * Retorna 202 imediatamente — a sync ocorre no ciclo after() do Next.
 */
export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("datex_session");
    if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    const payload = await verifyToken(session.value);
    if (!payload) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });

    const { id } = await params;

    const account = await prisma.mercadoLivreAccount.findFirst({
      where: { id, organizationId: payload.orgId, isActive: true },
      include: { token: true },
    });

    if (!account) return NextResponse.json({ error: "Conta não encontrada ou inativa." }, { status: 404 });
    if (!account.token) return NextResponse.json({ error: "Conta sem token OAuth. Reconecte via OAuth." }, { status: 400 });
    if (account.token.expiresAt < new Date() && account.token.accessToken === account.token.refreshToken) {
      return NextResponse.json({ error: "Token expirado. Reconecte a conta via OAuth." }, { status: 400 });
    }
    if (account.lastSyncStatus === "SYNCING") {
      return NextResponse.json({ success: true, message: "Sincronização já está em andamento." }, { status: 200 });
    }

    // Marca como SYNCING
    await prisma.mercadoLivreAccount.update({
      where: { id },
      data: { lastSyncStatus: "SYNCING", lastSyncProgress: 0, lastSyncError: null },
    });

    after(async () => {
      try {
        const { MercadoLivreSyncService } = await import("@/services/mercado-livre-sync.service");
        const report = await MercadoLivreSyncService.syncAccount(
          id,
          payload.orgId,
          payload.userId,
          undefined,
          async (progress) => {
            await prisma.mercadoLivreAccount.update({
              where: { id },
              data: { lastSyncProgress: progress },
            });
          }
        );
        await prisma.mercadoLivreAccount.update({
          where: { id },
          data: {
            lastSyncAt: new Date(),
            lastSyncStatus: report.errors.length === 0 ? "SUCCESS" : "PARTIAL",
            lastSyncProgress: 100,
            lastSyncError: report.errors.length > 0 ? report.errors.join("; ") : null,
          },
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        await prisma.mercadoLivreAccount.update({
          where: { id },
          data: { lastSyncStatus: "FAILED", lastSyncError: msg, lastSyncAt: new Date(), lastSyncProgress: 100 },
        });
      }
    });

    return NextResponse.json(
      { success: true, message: "Sincronização iniciada. Você pode continuar usando o sistema." },
      { status: 202 }
    );
  } catch (err: any) {
    console.error("POST .../sync error:", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
