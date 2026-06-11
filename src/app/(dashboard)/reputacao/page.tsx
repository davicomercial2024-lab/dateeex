"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Award, RefreshCw, AlertTriangle, Star, TrendingDown, Info } from "lucide-react";
import { useMeli } from "@/context/meli-context";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

// ─── Tipos ──────────────────────────────────────────────────────────────────
interface ReputationItem {
  id: string;
  levelId: string | null;
  powerSellerStatus: string | null;
  claimsRate: number | string;
  cancellationsRate: number | string;
  delayedHandlingTimeRate: number | string;
  salesCompleted: number;
  salesPeriod: string;
  createdAt: string;
  account: { nickname: string; meliUserId: string };
}

// ─── Mapeamentos de Reputação ──────────────────────────────────────────────
const REP_MAP: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  "5_green":       { label: "Verde — Excelente",   color: "#10b981", bg: "border-emerald-500/30 bg-emerald-500/5",  dot: "bg-emerald-500" },
  "4_light_green": { label: "Verde Claro — Bom",   color: "#14b8a6", bg: "border-teal-500/30 bg-teal-500/5",       dot: "bg-teal-500" },
  "3_yellow":      { label: "Amarelo — Regular",   color: "#f59e0b", bg: "border-amber-500/30 bg-amber-500/5",     dot: "bg-amber-500" },
  "2_orange":      { label: "Laranja — Ruim",      color: "#f97316", bg: "border-orange-500/30 bg-orange-500/5",   dot: "bg-orange-500" },
  "1_red":         { label: "Vermelho — Crítico",  color: "#ef4444", bg: "border-red-500/30 bg-red-500/5",         dot: "bg-red-500" },
};

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`rounded-lg bg-muted animate-pulse ${className}`} />;
}

function formatPercent(v: number | string) {
  return `${(Number(v) * 100).toFixed(2).replace(".", ",")}%`;
}

function ReputationCard({ rep }: { rep: ReputationItem }) {
  const level = REP_MAP[rep.levelId ?? ""] ?? { label: rep.levelId || "Desconhecido", color: "#888", bg: "border-border bg-muted/10", dot: "bg-muted-foreground" };

  const metrics = [
    { label: "Taxa de Reclamações",  value: Number(rep.claimsRate),              threshold: 0.03, badColor: "bg-destructive", goodColor: "bg-emerald-500" },
    { label: "Cancelamentos",        value: Number(rep.cancellationsRate),        threshold: 0.03, badColor: "bg-destructive", goodColor: "bg-emerald-500" },
    { label: "Atrasos no Envio",     value: Number(rep.delayedHandlingTimeRate),  threshold: 0.05, badColor: "bg-orange-500",  goodColor: "bg-emerald-500" },
  ];

  return (
    <Card className={`border ${level.bg} backdrop-blur-sm`}>
      <CardHeader className="pb-3 border-b border-border/30">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-400" />
              {rep.account.nickname}
            </CardTitle>
            <CardDescription className="text-[10px] mt-0.5">
              ID: {rep.account.meliUserId} · {rep.salesCompleted.toLocaleString("pt-BR")} vendas ({rep.salesPeriod})
            </CardDescription>
          </div>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${level.bg}`}>
            <span className={`w-2 h-2 rounded-full ${level.dot}`} />
            {level.label}
          </span>
        </div>
        {rep.powerSellerStatus && (
          <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-full text-[10px] font-bold">
            <Award className="w-3 h-3" /> Power Seller: {rep.powerSellerStatus.charAt(0).toUpperCase() + rep.powerSellerStatus.slice(1)}
          </div>
        )}
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {metrics.map((m) => {
          const pct = Math.min(m.value * 100 * 20, 100); // escala visual
          const isBad = m.value > m.threshold;
          return (
            <div key={m.label} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-muted-foreground">{m.label}</span>
                <span className={`font-bold ${isBad ? "text-destructive" : "text-emerald-500"}`}>
                  {formatPercent(m.value)}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${isBad ? m.badColor : m.goodColor}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {isBad && (
                <p className="text-[10px] text-destructive font-medium flex items-center gap-1">
                  <TrendingDown className="w-3 h-3" /> Acima do limite recomendado ({formatPercent(m.threshold)})
                </p>
              )}
            </div>
          );
        })}
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground pt-1 border-t border-border/40">
          <Info className="w-3 h-3 shrink-0" />
          Atualizado em {new Date(rep.createdAt).toLocaleDateString("pt-BR")}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Componente Principal ──────────────────────────────────────────────────
export default function ReputacaoPage() {
  const { accounts, selectedAccountId, selectedAccount, isSyncing, triggerSync } = useMeli();

  const [reputations, setReputations] = useState<ReputationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReputation = useCallback(async (accountId: string) => {
    setIsLoading(true);
    setError(null);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const res = await fetch(`/api/reputation?accountId=${accountId}`, { signal: controller.signal });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao carregar reputação.");
      setReputations(data.reputations || []);
    } catch (err: any) {
      if (err.name !== "AbortError") setError(err.message || "Erro desconhecido.");
      else setError("A requisição demorou mais de 30 segundos. Tente novamente.");
    } finally {
      clearTimeout(timeout);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (accounts.length > 0) fetchReputation(selectedAccountId);
  }, [selectedAccountId, accounts.length, fetchReputation]);

  if (accounts.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-foreground/90">Reputação do Vendedor</h1>
          <p className="text-xs md:text-sm text-muted-foreground font-medium">Monitore o termômetro, reclamações e cancelamentos oficiais.</p>
        </div>
        <EmptyState title="Nenhuma conta conectada" description="Vincule sua conta do Mercado Livre para monitorar sua reputação e alertas de performance." icon={Award} pageName="Reputação" />
      </div>
    );
  }

  const accountLabel = selectedAccountId === "all"
    ? `${accounts.length} conta(s) consolidada(s)` : (selectedAccount?.nickname ?? "");

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-5">
        <div className="space-y-1">
          <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-foreground/90">Reputação do Vendedor</h1>
          <p className="text-xs md:text-sm text-muted-foreground font-medium">{accountLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fetchReputation(selectedAccountId)} disabled={isLoading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-border/60 bg-card text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-accent transition-all cursor-pointer disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-primary" : ""}`} />
            Atualizar
          </button>
          <Button onClick={async () => { await triggerSync(); await fetchReputation(selectedAccountId); }}
            disabled={isSyncing || isLoading} size="sm" className="rounded-xl text-xs font-bold gap-2">
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "Sincronizando..." : "Sincronizar agora"}
          </Button>
        </div>
      </div>

      {/* Erro */}
      {error && (
        <div className="p-4 rounded-2xl border border-destructive/30 bg-destructive/5 text-destructive text-xs font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
          <button onClick={() => fetchReputation(selectedAccountId)} className="ml-auto underline cursor-pointer">Tentar novamente</button>
        </div>
      )}

      {/* Loading */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border/60 p-5 bg-card space-y-4">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-2.5 w-full" />
              <Skeleton className="h-2.5 w-4/5" />
              <Skeleton className="h-2.5 w-3/5" />
            </div>
          ))}
        </div>
      ) : reputations.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 border border-dashed border-border/60 rounded-2xl bg-card/40 text-center gap-4">
          <div className="p-4 rounded-full bg-primary/10"><Award className="w-8 h-8 text-primary" /></div>
          <div>
            <h3 className="text-base font-bold text-foreground mb-1">Nenhuma reputação sincronizada</h3>
            <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
              Sua conta está conectada, mas ainda não encontramos dados de reputação. Clique em "Sincronizar agora".
            </p>
          </div>
          <Button onClick={async () => { await triggerSync(); await fetchReputation(selectedAccountId); }} disabled={isSyncing} className="gap-2 rounded-xl font-bold">
            <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "Sincronizando..." : "Sincronizar agora"}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {reputations.map((rep) => <ReputationCard key={rep.id} rep={rep} />)}
        </div>
      )}
    </div>
  );
}
