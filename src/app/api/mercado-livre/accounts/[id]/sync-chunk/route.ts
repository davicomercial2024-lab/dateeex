import { NextResponse } from "next/server";
import { MercadoLivreSyncService } from "@/services/mercado-livre-sync.service";
import { pbAdmin } from "@/lib/pb";

import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("datex_session");
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = await verifyToken(session.value);
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const orgId = payload.orgId;

    const { id: accountId } = await params;
    if (!accountId) {
      return NextResponse.json({ error: "Missing account ID" }, { status: 400 });
    }

    const body = await request.json();
    const { step, offset = 0, limit = 50 } = body;

    if (!step) {
      return NextResponse.json({ error: "Missing step" }, { status: 400 });
    }

    let result = { hasMore: false, total: 0 };

    switch (step) {
      case "details":
        await MercadoLivreSyncService.syncDetailsAndReputation(accountId, orgId);
        result = { hasMore: false, total: 1 };
        break;
      case "listings":
        result = await MercadoLivreSyncService.syncListingsChunk(accountId, orgId, offset, limit);
        break;
      case "orders":
        result = await MercadoLivreSyncService.syncOrdersChunk(accountId, orgId, offset, limit);
        break;
      case "questions":
        result = await MercadoLivreSyncService.syncQuestionsChunk(accountId, orgId, offset, limit);
        break;
      default:
        return NextResponse.json({ error: "Invalid step" }, { status: 400 });
    }

    // Se tudo acabou e foi o último step (questions sem mais hasMore), marcamos como SUCCESS
    if (step === "questions" && !result.hasMore) {
      await pbAdmin.collection("mercado_livre_accounts").update(accountId, {
        lastSyncStatus: "SUCCESS",
        lastSyncAt: new Date().toISOString()
      });
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error("[Sync Chunk Error]:", error);
    return NextResponse.json({ error: error.message || "Internal error" }, { status: 500 });
  }
}
