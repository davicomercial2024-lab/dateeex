import { pbAdmin } from "@/lib/pb";
import { MercadoLivreSyncService } from "@/services/mercado-livre-sync.service";

type BackgroundSyncJob = {
  accountId: string;
  organizationId: string;
  startedAt: string;
  cancelled: boolean;
};

type GlobalSyncState = {
  jobs: Map<string, BackgroundSyncJob>;
};

const globalSyncState = globalThis as typeof globalThis & {
  __datexMeliBackgroundSync?: GlobalSyncState;
};

const state =
  globalSyncState.__datexMeliBackgroundSync ??
  (globalSyncState.__datexMeliBackgroundSync = { jobs: new Map<string, BackgroundSyncJob>() });

async function ensureAdminAuth() {
  await pbAdmin.admins.authWithPassword(
    process.env.PB_ADMIN_EMAIL as string,
    process.env.PB_ADMIN_PASS as string
  );
}

async function updateAccount(accountId: string, data: Record<string, unknown>) {
  await ensureAdminAuth();
  await pbAdmin.collection("mercado_livre_accounts").update(accountId, data, { requestKey: null });
}

function nextProgress(base: number, range: number, current: number, total: number) {
  if (!total || total <= 0) return base + range;
  return Math.min(base + range, base + (Math.min(current, total) / total) * range);
}

export class MercadoLivreBackgroundSyncService {
  static isRunning(accountId: string) {
    return state.jobs.has(accountId);
  }

  static start(accountId: string, organizationId: string) {
    if (state.jobs.has(accountId)) {
      return { started: false, alreadyRunning: true };
    }

    state.jobs.set(accountId, {
      accountId,
      organizationId,
      startedAt: new Date().toISOString(),
      cancelled: false,
    });

    void this.run(accountId, organizationId);

    return { started: true, alreadyRunning: false };
  }

  static cancel(accountId: string) {
    const job = state.jobs.get(accountId);
    if (!job) return false;
    job.cancelled = true;
    return true;
  }

  private static assertNotCancelled(accountId: string) {
    if (state.jobs.get(accountId)?.cancelled) {
      throw new Error("Sincronizacao cancelada porque a conta foi desconectada.");
    }
  }

  private static async run(accountId: string, organizationId: string) {
    try {
      this.assertNotCancelled(accountId);
      await updateAccount(accountId, {
        lastSyncStatus: "SYNCING",
        lastSyncError: "",
        lastSyncProgress: 1,
      });

      this.assertNotCancelled(accountId);
      await MercadoLivreSyncService.syncDetailsAndReputation(accountId, organizationId);
      await updateAccount(accountId, { lastSyncProgress: 8 });

      let listingsOffset = 0;
      let listingsScrollId: string | undefined;
      let listingsHasMore = true;

      while (listingsHasMore) {
        this.assertNotCancelled(accountId);
        const result = await MercadoLivreSyncService.syncListingsChunk(
          accountId,
          organizationId,
          listingsScrollId,
          500
        );

        listingsHasMore = result.hasMore;
        listingsScrollId = result.scrollId;
        listingsOffset += 500;

        this.assertNotCancelled(accountId);
        await updateAccount(accountId, {
          lastSyncProgress: Math.round(nextProgress(8, 52, listingsOffset, result.total)),
        });
      }

      let ordersOffset = 0;
      let ordersHasMore = true;

      while (ordersHasMore) {
        this.assertNotCancelled(accountId);
        const result = await MercadoLivreSyncService.syncOrdersChunk(accountId, organizationId, ordersOffset, 500);
        ordersHasMore = result.hasMore;
        ordersOffset += 500;

        this.assertNotCancelled(accountId);
        await updateAccount(accountId, {
          lastSyncProgress: Math.round(nextProgress(60, 25, ordersOffset, result.total)),
        });
      }

      let questionsOffset = 0;
      let questionsHasMore = true;

      while (questionsHasMore) {
        this.assertNotCancelled(accountId);
        const result = await MercadoLivreSyncService.syncQuestionsChunk(accountId, organizationId, questionsOffset, 500);
        questionsHasMore = result.hasMore;
        questionsOffset += 500;

        this.assertNotCancelled(accountId);
        await updateAccount(accountId, {
          lastSyncProgress: Math.round(nextProgress(85, 15, questionsOffset, result.total)),
        });
      }

      await updateAccount(accountId, {
        lastSyncStatus: "SUCCESS",
        lastSyncAt: new Date().toISOString(),
        lastSyncProgress: 100,
        lastSyncError: "",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha na sincronizacao em segundo plano.";
      console.error("[Meli Background Sync] failed:", error);
      if (!state.jobs.get(accountId)?.cancelled) {
        await updateAccount(accountId, {
          lastSyncStatus: "FAILED",
          lastSyncError: message,
        }).catch(() => null);
      }
    } finally {
      state.jobs.delete(accountId);
    }
  }
}
