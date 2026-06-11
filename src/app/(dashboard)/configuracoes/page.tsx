"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Settings, RefreshCw, AlertTriangle, CheckCircle2, XCircle,
  Clock, Database, Wifi, Key, Activity, ChevronDown, ChevronUp, Terminal,
} from "lucide-react";
import { useMeli } from "@/context/meli-context";
import { SyncProgress } from "@/components/sync-progress";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// ─── Tipos ───────────────────────────────────────────────────────────────────
interface DiagnosticToken {
  expiresAt: string;
  isExpired: boolean;
  isMock: boolean;
  minutesUntilExpiry: number;
}
interface DiagnosticLog { action: string; details: string | null; createdAt: string; }
interface Diagnostic {
  account: {
    id: string;
    nickname: string;
    meliUserId: string;
    email: string | null;
    status: string;
    lastSyncStatus: string | null;
    lastSyncProgress: number;
  };
  token: DiagnosticToken | null;
  counts: { listings: number; orders: number; questions: number };
  lastAuditLog: DiagnosticLog | null;
  lastSyncLog: DiagnosticLog | null;
}

interface TestResult { ok: boolean; statusCode: number; nickname?: string; meliUserId?: number; error?: string; }

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`rounded-lg bg-muted animate-pulse ${className}`} />;
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span className={`inline-flex w-2 h-2 rounded-full ${ok ? "bg-emerald-500" : "bg-destructive"}`} />
  );
}

function TokenStatus({ token }: { token: DiagnosticToken | null }) {
  if (!token) return <span className="text-xs text-destructive font-semibold">Sem token salvo</span>;
  if (token.isMock) return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-500">
      <Key className="w-3 h-3" /> Token Sandbox/Mock — Reconecte via OAuth oficial
    </span>
  );
  if (token.isExpired) return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-destructive">
      <XCircle className="w-3 h-3" /> Expirado — Reconecte a conta
    </span>
  );
  const hrs = Math.floor(token.minutesUntilExpiry / 60);
  const mins = token.minutesUntilExpiry % 60;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-500">
      <CheckCircle2 className="w-3 h-3" /> Válido — expira em {hrs > 0 ? `${hrs}h ` : ""}{mins}min
    </span>
  );
}

// ─── Card por conta ───────────────────────────────────────────────────────────
function AccountDiagnosticCard({
  diag,
  onSync,
  isSyncing,
}: {
  diag: Diagnostic;
  onSync: (accountId: string) => void;
  isSyncing: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/integrations/diagnostics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: diag.account.id }),
      });
      const data = await res.json();
      setTestResult(data.testResult || { ok: false, statusCode: 0, error: "Resposta inválida." });
    } catch (err: any) {
      setTestResult({ ok: false, statusCode: 0, error: err.message });
    } finally {
      setTesting(false);
    }
  };

  const totalSynced = diag.counts.listings + diag.counts.orders + diag.counts.questions;

  return (
    <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
      <CardHeader className="pb-3 border-b border-border/30">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center font-black text-sm text-primary shrink-0">
              {diag.account.nickname.charAt(0)}
            </div>
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                {diag.account.nickname}
                <StatusDot ok={diag.account.status === "CONNECTED"} />
              </CardTitle>
              <CardDescription className="text-[10px]">
                ID Meli: {diag.account.meliUserId} · {diag.account.email || "sem email"}
              </CardDescription>
            </div>
          </div>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1.5 rounded-lg hover:bg-accent/60 text-muted-foreground cursor-pointer transition-colors"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* Token */}
        <div className="flex items-center justify-between py-2 border-b border-border/30">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
            <Key className="w-3 h-3" /> Status do Token
          </span>
          <TokenStatus token={diag.token} />
        </div>

        {/* Contagens */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Anúncios",   value: diag.counts.listings,  Icon: Database },
            { label: "Pedidos",    value: diag.counts.orders,     Icon: Activity },
            { label: "Perguntas",  value: diag.counts.questions,  Icon: Terminal },
          ].map((c) => (
            <div key={c.label} className="rounded-xl border border-border/60 bg-secondary/20 p-3 text-center">
              <c.Icon className="w-3.5 h-3.5 text-muted-foreground mx-auto mb-1" />
              <p className="text-lg font-black text-foreground">{c.value.toLocaleString("pt-BR")}</p>
              <p className="text-[10px] text-muted-foreground font-medium">{c.label}</p>
            </div>
          ))}
        </div>

        {totalSynced === 0 && (
          <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-500 text-xs font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Nenhum dado sincronizado ainda. Clique em "Sincronizar" para importar os dados do Mercado Livre.
          </div>
        )}

        {/* Última sincronização */}
        {diag.lastSyncLog && (
          <div className="rounded-xl border border-border/40 bg-secondary/10 p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              <Clock className="w-3 h-3" /> Última Sincronização
            </div>
            <p className="text-xs font-semibold text-foreground">{diag.lastSyncLog.action}</p>
            <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2">{diag.lastSyncLog.details}</p>
            <p className="text-[10px] text-muted-foreground/60">{new Date(diag.lastSyncLog.createdAt).toLocaleString("pt-BR")}</p>
          </div>
        )}

        {diag.account.lastSyncStatus === "SYNCING" && (
          <SyncProgress
            compact
            progress={diag.account.lastSyncProgress}
            label={`Sincronizando ${diag.account.nickname}`}
          />
        )}

        {/* Expanded: Logs e auditoria */}
        {expanded && diag.lastAuditLog && (
          <div className="rounded-xl border border-border/40 bg-secondary/10 p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              <Terminal className="w-3 h-3" /> Último Evento de Auditoria
            </div>
            <p className="text-xs font-semibold text-foreground">{diag.lastAuditLog.action}</p>
            <p className="text-[10px] text-muted-foreground leading-relaxed">{diag.lastAuditLog.details}</p>
            <p className="text-[10px] text-muted-foreground/60">{new Date(diag.lastAuditLog.createdAt).toLocaleString("pt-BR")}</p>
          </div>
        )}

        {/* Resultado do Teste de API */}
        {testResult && (
          <div className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
            testResult.ok
              ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-500"
              : "border-destructive/30 bg-destructive/5 text-destructive"
          }`}>
            {testResult.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
            {testResult.ok
              ? `API OK · Conta: ${testResult.nickname} (ID: ${testResult.meliUserId})`
              : testResult.error}
          </div>
        )}

        {/* Ações */}
        <div className="flex items-center gap-2 pt-1">
          <Button
            onClick={() => onSync(diag.account.id)}
            disabled={isSyncing}
            size="sm"
            className="flex-1 rounded-xl text-xs font-bold gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "Sincronizando..." : "Sincronizar agora"}
          </Button>
          <Button
            onClick={handleTest}
            disabled={testing || (diag.token?.isMock ?? true)}
            variant="outline"
            size="sm"
            className="flex-1 rounded-xl text-xs font-bold gap-2"
            title={diag.token?.isMock ? "Disponível apenas para tokens OAuth reais" : "Testar conexão com a API do Mercado Livre"}
          >
            <Wifi className={`w-3.5 h-3.5 ${testing ? "animate-pulse" : ""}`} />
            {testing ? "Testando..." : "Testar API"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Componente Principal ──────────────────────────────────────────────────
export default function ConfiguracoesPage() {
  const { accounts, selectedAccountId, isSyncing, triggerSync, refreshAccounts } = useMeli();

  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null);

  const fetchDiagnostics = useCallback(async (quiet = false): Promise<Diagnostic[]> => {
    if (!quiet) setIsLoading(true);
    setError(null);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const res = await fetch("/api/integrations/diagnostics", { signal: controller.signal });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao carregar diagnóstico.");
      const nextDiagnostics = data.diagnostics || [];
      setDiagnostics(nextDiagnostics);
      return nextDiagnostics;
    } catch (err: any) {
      if (err.name !== "AbortError") setError(err.message || "Erro desconhecido.");
      else setError("Tempo limite excedido. Tente novamente.");
      return [];
    } finally {
      clearTimeout(timeout);
      if (!quiet) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDiagnostics();
  }, [fetchDiagnostics]);

  useEffect(() => {
    if (!syncingAccountId) return;

    const interval = window.setInterval(async () => {
      const latest = await fetchDiagnostics(true);
      const account = latest.find((diag) => diag.account.id === syncingAccountId);
      if (account && account.account.lastSyncStatus !== "SYNCING") {
        setSyncingAccountId(null);
      }
    }, 700);

    return () => window.clearInterval(interval);
  }, [syncingAccountId, fetchDiagnostics]);

  const handleSyncAccount = async (accountId: string) => {
    setSyncingAccountId(accountId);
    try {
      await fetch("/api/mercado-livre/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId }),
      });
      await Promise.all([fetchDiagnostics(true), refreshAccounts()]);
    } catch (err: any) {
      console.error("Erro ao sincronizar conta:", err);
      setSyncingAccountId(null);
    } finally {
      // Mantém o polling ativo até o backend sair de SYNCING.
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-5">
        <div className="space-y-1">
          <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-foreground/90 flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            Configurações & Integrações
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground font-medium">
            Diagnóstico técnico, status de conexão e controles de sincronização.
          </p>
        </div>
        <button
          onClick={() => fetchDiagnostics()}
          disabled={isLoading}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-border/60 bg-card text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-accent transition-all cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-primary" : ""}`} />
          Atualizar diagnóstico
        </button>
      </div>

      {/* Info box */}
      <div className="p-4 rounded-2xl border border-primary/20 bg-primary/5 text-xs text-foreground/80 font-medium leading-relaxed flex items-start gap-3">
        <Activity className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <div>
          <strong className="font-bold text-foreground">Área técnica de diagnóstico.</strong>{" "}
          Aqui você pode verificar o status do token OAuth de cada conta, quando foi a última sincronização,
          quantos dados já foram importados e testar a conectividade direta com a API do Mercado Livre.
          Esta área não afeta o painel principal.
        </div>
      </div>

      {/* Erro */}
      {error && (
        <div className="p-4 rounded-2xl border border-destructive/30 bg-destructive/5 text-destructive text-xs font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
          <button onClick={() => fetchDiagnostics()} className="ml-auto underline cursor-pointer">Tentar novamente</button>
        </div>
      )}

      {/* Loading */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border/60 p-5 bg-card space-y-4">
              <div className="flex items-center gap-3">
                <Skeleton className="w-9 h-9 rounded-xl" />
                <div className="space-y-1.5"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-24" /></div>
              </div>
              <Skeleton className="h-3 w-full" />
              <div className="grid grid-cols-3 gap-3">
                {[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
              </div>
              <Skeleton className="h-9 rounded-xl" />
            </div>
          ))}
        </div>
      ) : diagnostics.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 border border-dashed border-border/60 rounded-2xl bg-card/40 text-center gap-4">
          <div className="p-4 rounded-full bg-primary/10"><Settings className="w-8 h-8 text-primary" /></div>
          <div>
            <h3 className="text-base font-bold text-foreground mb-1">Nenhuma conta conectada</h3>
            <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
              Conecte uma conta do Mercado Livre via OAuth para visualizar o diagnóstico técnico aqui.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {diagnostics.map((diag) => (
            <AccountDiagnosticCard
              key={diag.account.id}
              diag={diag}
              onSync={handleSyncAccount}
              isSyncing={syncingAccountId === diag.account.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
