"use client";

import { RefreshCw } from "lucide-react";
import { MeliAccount } from "@/context/meli-context";

type SyncProgressProps = {
  account?: MeliAccount;
  label?: string;
  compact?: boolean;
  progress?: number;
};

function clampProgress(value: number) {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function getDefaultProgress(account?: MeliAccount) {
  if (account?.lastSyncStatus === "SYNCING") {
    return account.lastSyncProgress ?? 0;
  }

  return 100;
}

export function SyncProgress({ account, label, compact = false, progress }: SyncProgressProps) {
  const counts = account?.counts;
  const resolvedProgress = clampProgress(progress ?? getDefaultProgress(account));
  const title = label ?? "Sincronizacao em andamento";

  const statusText =
    resolvedProgress >= 100
      ? "Sincronizacao concluida"
      : resolvedProgress >= 85
        ? "Consolidando resposta"
        : resolvedProgress >= 60
          ? "Atualizando dados"
          : resolvedProgress >= 30
            ? "Processando integrações"
            : "Preparando sincronizacao";

  return (
    <div
      className={
        compact
          ? "w-full space-y-2 rounded-xl border border-sky-500/20 bg-sky-500/5 p-2.5"
          : "w-full space-y-3 rounded-2xl border border-sky-500/20 bg-sky-500/5 p-3.5 shadow-sm"
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <RefreshCw className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-sky-500" />
          <div className="min-w-0">
            <span className="block truncate text-[10px] font-bold uppercase tracking-[0.18em] text-sky-600 dark:text-sky-400">
              {title}
            </span>
            {!compact && (
              <span className="mt-0.5 block text-[10px] font-medium text-muted-foreground">
                {statusText}
              </span>
            )}
          </div>
        </div>

        <div className="shrink-0 text-right">
          <span className="block text-sm font-black tabular-nums text-sky-700 dark:text-sky-300">
            {resolvedProgress}%
          </span>
          {!compact && <span className="block text-[9px] font-medium text-muted-foreground">progresso</span>}
        </div>
      </div>

      <div className="relative h-2.5 overflow-hidden rounded-full bg-sky-500/10" aria-label={`Progresso do sync: ${resolvedProgress}%`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={resolvedProgress}>
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-sky-400 via-sky-500 to-cyan-500 transition-[width] duration-300 ease-out"
          style={{ width: `${resolvedProgress}%` }}
        />
        {resolvedProgress < 100 && (
          <div className="sync-progress-bar absolute inset-y-0 left-0 rounded-full bg-white/40" />
        )}
      </div>

      {!compact && counts && (
        <div className="grid grid-cols-3 gap-2 text-[10px] text-muted-foreground">
          <span>
            <strong className="text-foreground">{counts.listings.toLocaleString("pt-BR")}</strong> anuncios
          </span>
          <span>
            <strong className="text-foreground">{counts.orders.toLocaleString("pt-BR")}</strong> pedidos
          </span>
          <span>
            <strong className="text-foreground">{counts.questions.toLocaleString("pt-BR")}</strong> perguntas
          </span>
        </div>
      )}
    </div>
  );
}
