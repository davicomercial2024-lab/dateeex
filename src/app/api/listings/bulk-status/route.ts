import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { pbAdmin } from "@/lib/pb";
import { MercadoLivreApiService } from "@/services/mercado-livre-api.service";
import { MercadoLivreSyncService } from "@/services/mercado-livre-sync.service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ListingStatusAction = "active" | "paused";

function isAllowedStatus(value: unknown): value is ListingStatusAction {
  return value === "active" || value === "paused";
}

async function runWithConcurrency<T, R>(items: T[], concurrency: number, worker: (item: T) => Promise<R>) {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    results.push(...await Promise.all(items.slice(i, i + concurrency).map(worker)));
  }
  return results;
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("datex_session");
    if (!sessionCookie) return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });

    const session = await verifyToken(sessionCookie.value);
    if (!session) return NextResponse.json({ error: "Sessao expirada." }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const ids = Array.isArray(body.ids) ? body.ids.filter((id: unknown) => typeof id === "string") : [];
    const status = body.status;

    if (ids.length === 0) {
      return NextResponse.json({ error: "Selecione ao menos um anuncio." }, { status: 400 });
    }

    if (!isAllowedStatus(status)) {
      return NextResponse.json({ error: "Status invalido para anuncios." }, { status: 400 });
    }

    await pbAdmin.admins.authWithPassword(
      process.env.PB_ADMIN_EMAIL as string,
      process.env.PB_ADMIN_PASS as string
    );

    const filter = `organization="${session.orgId}" && (${ids.map((id: string) => `id="${id}"`).join(" || ")})`;
    const listings = await pbAdmin.collection("listings").getFullList({ filter, requestKey: null });

    if (listings.length === 0) {
      return NextResponse.json({ error: "Nenhum anuncio encontrado para esta organizacao." }, { status: 404 });
    }

    const accounts = new Map<string, { accessToken: string }>();
    const results = await runWithConcurrency(listings, 5, async (listing: any) => {
      try {
        let token = accounts.get(listing.account);
        if (!token) {
          const accountAndToken = await MercadoLivreSyncService.getAccountAndToken(listing.account, session.orgId);
          token = { accessToken: accountAndToken.token.accessToken };
          accounts.set(listing.account, token);
        }

        await MercadoLivreApiService.updateItemStatus(listing.mlItemId, status, token.accessToken);
        await pbAdmin.collection("listings").update(listing.id, { status }, { requestKey: null });

        return { id: listing.id, mlItemId: listing.mlItemId, success: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro ao atualizar anuncio.";
        return { id: listing.id, mlItemId: listing.mlItemId, success: false, error: message };
      }
    });

    const successCount = results.filter((result) => result.success).length;
    const errorCount = results.length - successCount;

    return NextResponse.json({
      success: true,
      summary: {
        total: results.length,
        successCount,
        errorCount,
        status,
      },
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno ao atualizar anuncios.";
    console.error("POST /api/listings/bulk-status error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
