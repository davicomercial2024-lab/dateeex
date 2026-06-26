"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Link2, Plus, RefreshCw, AlertTriangle, CheckCircle2, XCircle,
  Wifi, Star, Edit3, Trash2, Clock, Database, Package, HelpCircle,
  ExternalLink, Shield, X, ChevronDown, ChevronUp, Award,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SyncProgress } from "@/components/sync-progress";
import { useMeli, MeliAccount } from "@/context/meli-context";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}
function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`rounded-lg bg-muted animate-pulse ${className}`} />;
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  CONNECTED:    { label: "Conectada",    cls: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
  EXPIRED:      { label: "Token expirado", cls: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
  ERROR:        { label: "Erro",         cls: "bg-destructive/10 text-destructive border-destructive/20" },
  DISCONNECTED: { label: "Desconectada", cls: "bg-muted text-muted-foreground border-border" },
  SYNCING:      { label: "Sincronizando", cls: "bg-sky-500/10 text-sky-500 border-sky-500/20" },
};
function StatusBadge({ status, syncStatus }: { status: string; syncStatus: string | null }) {
  const activeStatus = syncStatus === "SYNCING" ? "SYNCING" : status;
  const cfg = STATUS_CONFIG[activeStatus as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.ERROR;
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border ${cfg.cls}`}>
      {activeStatus === "SYNCING" && <RefreshCw className="w-3 h-3 mr-1 animate-spin" />}
      {cfg.label}
    </span>
  );
}

// ─── Modal de confirmação de desconexão ───────────────────────────────────────
function DisconnectModal({
  account,
  onConfirm,
  onCancel,
  isLoading,
}: {
  account: MeliAccount;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md mx-4 rounded-2xl border border-border/60 bg-card shadow-2xl p-6 animate-in zoom-in-95 duration-200">
        <button onClick={onCancel} className="absolute top-4 right-4 p-1 rounded-lg hover:bg-accent text-muted-foreground cursor-pointer">
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-start gap-4">
          <div className="p-2.5 rounded-xl bg-destructive/10 shrink-0">
            <Trash2 className="w-5 h-5 text-destructive" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Desconectar conta?</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Tem certeza que deseja desconectar{" "}
              <strong className="text-foreground">{account.displayName}</strong>?
              As métricas históricas serão mantidas, mas novas sincronizações serão interrompidas.
            </p>
          </div>
        </div>
        <div className="flex gap-2 mt-6 justify-end">
          <Button variant="outline" onClick={onCancel} disabled={isLoading} className="rounded-xl text-xs">Cancelar</Button>
          <Button onClick={onConfirm} disabled={isLoading} className="rounded-xl text-xs bg-destructive hover:bg-destructive/90 text-destructive-foreground gap-2">
            {isLoading ? <><RefreshCw className="w-3 h-3 animate-spin" />Desconectando...</> : <><Trash2 className="w-3 h-3" />Sim, desconectar</>}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal de edição de apelido ───────────────────────────────────────────────
function EditNicknameModal({
  account,
  onSave,
  onCancel,
  isLoading,
}: {
  account: MeliAccount;
  onSave: (value: string) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [value, setValue] = useState(account.nicknameCustom || "");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm mx-4 rounded-2xl border border-border/60 bg-card shadow-2xl p-6 animate-in zoom-in-95 duration-200">
        <button onClick={onCancel} className="absolute top-4 right-4 p-1 rounded-lg hover:bg-accent text-muted-foreground cursor-pointer">
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-primary/10"><Edit3 className="w-4 h-4 text-primary" /></div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Editar apelido</h3>
            <p className="text-[10px] text-muted-foreground">{account.nickname}</p>
          </div>
        </div>
        <div className="space-y-2 mb-5">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            Apelido interno
          </label>
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Ex: Conta Principal, Loja Atacado..."
            maxLength={40}
            className="w-full px-3 py-2.5 rounded-xl border border-border/60 bg-background/50 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all"
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") onSave(value); }}
          />
          <p className="text-[10px] text-muted-foreground">Deixe em branco para usar o nome oficial do ML.</p>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onCancel} disabled={isLoading} className="rounded-xl text-xs">Cancelar</Button>
          <Button onClick={() => onSave(value)} disabled={isLoading} className="rounded-xl text-xs gap-2">
            {isLoading ? <><RefreshCw className="w-3 h-3 animate-spin" />Salvando...</> : "Salvar apelido"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal de Sincronização Fracionada ────────────────────────────────────────
function AccountCard({
  account,
  onRefresh,
  onStartSync,
  isStartingSync,
}: {
  account: MeliAccount;
  onRefresh: () => Promise<void>;
  onStartSync: (account: MeliAccount) => void;
  isStartingSync?: boolean;
}) {
  const [showError, setShowError] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isSavingNickname, setIsSavingNickname] = useState(false);
  const [isSettingDefault, setIsSettingDefault] = useState(false);

  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean; status: string; message: string; icon: string;
  } | null>(null);

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/mercado-livre/accounts/${account.id}/test-connection`, { method: "POST" });
      const data = await res.json();
      setTestResult(data.result);
      if (data.result?.ok) await onRefresh();
    } catch (err: any) {
      setTestResult({ ok: false, status: "Erro", message: err.message, icon: "error" });
    } finally {
      setIsTesting(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      const res = await fetch(`/api/mercado-livre/accounts/${account.id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Erro ao desconectar.");
      }
      setShowDisconnectModal(false);
      await onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleSaveNickname = async (value: string) => {
    setIsSavingNickname(true);
    try {
      const res = await fetch(`/api/mercado-livre/accounts/${account.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nicknameCustom: value }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Erro ao salvar apelido.");
      }
      setShowEditModal(false);
      await onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSavingNickname(false);
    }
  };

  const handleSetDefault = async () => {
    setIsSettingDefault(true);
    try {
      await fetch(`/api/mercado-livre/accounts/${account.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      });
      await onRefresh();
    } catch { } finally {
      setIsSettingDefault(false);
    }
  };

  return (
    <>
      {showDisconnectModal && (
        <DisconnectModal
          account={account}
          onConfirm={handleDisconnect}
          onCancel={() => setShowDisconnectModal(false)}
          isLoading={isDisconnecting}
        />
      )}
      {showEditModal && (
        <EditNicknameModal
          account={account}
          onSave={handleSaveNickname}
          onCancel={() => setShowEditModal(false)}
          isLoading={isSavingNickname}
        />
      )}

      <Card className="border-border/60 bg-card/60 backdrop-blur-sm flex flex-col">
        {/* Header */}
        <CardHeader className="pb-3 border-b border-border/30">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {/* Avatar */}
              <div className="relative w-11 h-11 rounded-xl bg-gradient-to-tr from-primary/20 to-indigo-500/20 flex items-center justify-center font-black text-lg text-primary shrink-0 border border-primary/20">
                {account.displayName.charAt(0)}
                {account.isDefault && (
                  <span className="absolute -top-1.5 -right-1.5 bg-amber-400 rounded-full p-0.5">
                    <Star className="w-2.5 h-2.5 text-white" />
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <CardTitle className="text-sm font-bold text-foreground leading-tight">
                    {account.displayName}
                  </CardTitle>
                  {account.isDefault && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-400/15 text-amber-500 font-bold border border-amber-400/30">
                      PADRÃO
                    </span>
                  )}
                </div>
                {account.nicknameCustom && (
                  <CardDescription className="text-[10px] font-mono mt-0.5">{account.nickname}</CardDescription>
                )}
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-[10px] text-muted-foreground font-medium">ID: {account.meliUserId}</span>
                  {account.siteId && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground font-bold border border-border/40">
                      {account.siteId}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <StatusBadge status={account.status} syncStatus={account.lastSyncStatus} />
          </div>
        </CardHeader>

        <CardContent className="pt-4 flex flex-col flex-1 gap-4">
          {/* Contadores */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Anúncios", value: account.counts.listings, Icon: Package },
              { label: "Pedidos",  value: account.counts.orders,   Icon: Database },
              { label: "Perguntas",value: account.counts.questions, Icon: HelpCircle },
            ].map((c) => (
              <div key={c.label} className="rounded-xl border border-border/50 bg-secondary/20 p-2.5 text-center">
                <c.Icon className="w-3.5 h-3.5 text-muted-foreground mx-auto mb-1" />
                <p className="text-base font-black text-foreground">{c.value.toLocaleString("pt-BR")}</p>
                <p className="text-[9px] text-muted-foreground">{c.label}</p>
              </div>
            ))}
          </div>

          {/* Última sync */}
          <div className="rounded-xl border border-border/40 bg-secondary/10 p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              <Clock className="w-3 h-3" /> Última sincronização
            </div>
            <p className="text-xs font-semibold text-foreground">
              {account.lastSyncAt ? formatDate(account.lastSyncAt) : "Nunca sincronizada"}
            </p>
            {account.lastSyncStatus && (
              <p className="text-[10px] text-muted-foreground capitalize">
                Status: <span className="font-semibold text-foreground">{account.lastSyncStatus}</span>
              </p>
            )}
            {account.lastSyncError && (
              <button
                onClick={() => setShowError((v) => !v)}
                className="flex items-center gap-1 text-[10px] text-destructive font-semibold cursor-pointer hover:underline"
              >
                <AlertTriangle className="w-3 h-3" />
                Último erro {showError ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            )}
            {showError && account.lastSyncError && (
              <p className="text-[10px] text-destructive/80 bg-destructive/5 rounded-lg px-2 py-1.5 border border-destructive/20 break-words leading-relaxed">
                {account.lastSyncError}
              </p>
            )}
          </div>

          {/* Aviso sem dados */}
          {account.lastSyncStatus === "SYNCING" && (
            <SyncProgress account={account} label={`Sincronizando ${account.displayName}`} />
          )}

          {account.counts.listings === 0 && account.counts.orders === 0 && account.lastSyncStatus !== "SYNCING" && (
            <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-600 text-xs font-semibold flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Conta conectada, mas sem dados sincronizados. Clique em "Sincronizar" para importar.</span>
            </div>
          )}

          {/* Resultado do teste */}
          {testResult && (
            <div className={`p-3 rounded-xl border text-xs font-semibold flex items-start gap-2 ${
              testResult.ok
                ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-600"
                : "border-destructive/30 bg-destructive/5 text-destructive"
            }`}>
              {testResult.ok
                ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                : <XCircle className="w-4 h-4 shrink-0 mt-0.5" />}
              <div>
                <p className="font-bold">{testResult.status}</p>
                <p className="font-normal opacity-90 mt-0.5">{testResult.message}</p>
              </div>
            </div>
          )}

          {/* Botões de ação */}
          <div className="flex flex-col gap-2 mt-auto pt-2 border-t border-border/30">
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => onStartSync(account)} disabled={isStartingSync || account.lastSyncStatus === "SYNCING"}
                size="sm" className="rounded-xl text-xs gap-1.5">
                <RefreshCw className={`w-3.5 h-3.5 ${isStartingSync || account.lastSyncStatus === "SYNCING" ? "animate-spin" : ""}`} />
                {isStartingSync ? "Iniciando..." : account.lastSyncStatus === "SYNCING" ? "Rodando" : "Sincronizar"}
              </Button>
              <Button onClick={handleTest} disabled={isTesting}
                variant="outline" size="sm" className="rounded-xl text-xs gap-1.5">
                <Wifi className={`w-3.5 h-3.5 ${isTesting ? "animate-pulse" : ""}`} />
                {isTesting ? "Testando..." : "Testar API"}
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => setShowEditModal(true)} variant="outline"
                size="sm" className="rounded-xl text-xs gap-1.5">
                <Edit3 className="w-3.5 h-3.5" />
                Editar apelido
              </Button>
              {!account.isDefault ? (
                <Button onClick={handleSetDefault} disabled={isSettingDefault}
                  variant="outline" size="sm" className="rounded-xl text-xs gap-1.5 text-amber-600 border-amber-500/30 hover:bg-amber-500/10">
                  <Star className="w-3.5 h-3.5" />
                  {isSettingDefault ? "..." : "Definir padrão"}
                </Button>
              ) : (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 text-amber-600 text-xs font-semibold flex items-center justify-center gap-1.5">
                  <Award className="w-3.5 h-3.5" /> Conta padrão
                </div>
              )}
            </div>
            <Button onClick={() => setShowDisconnectModal(true)}
              variant="outline" size="sm"
              className="rounded-xl text-xs gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10 w-full">
              <Trash2 className="w-3.5 h-3.5" />
              Desconectar conta
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

// ─── Componente de Banner (SSR-safe via Suspense) ─────────────────────────────
function StatusBanner() {
  const searchParams = useSearchParams();
  const connected = searchParams.get("connected");
  const reconnected = searchParams.get("reconnected");
  const nickname = searchParams.get("nickname");
  const error = searchParams.get("error");
  const errorMsg = searchParams.get("msg");

  if (connected === "true") {
    return (
      <div className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400 text-sm font-semibold flex items-center gap-3 animate-in fade-in duration-500">
        <CheckCircle2 className="w-5 h-5 shrink-0" />
        <div>
          <p className="font-bold">Conta Mercado Livre conectada com sucesso!</p>
          {nickname && <p className="text-xs font-medium opacity-90 mt-0.5">A conta <strong>{nickname}</strong> foi adicionada e a sincronização inicial foi iniciada em segundo plano.</p>}
        </div>
      </div>
    );
  }
  if (reconnected === "true") {
    return (
      <div className="p-4 rounded-2xl border border-sky-500/30 bg-sky-500/5 text-sky-700 dark:text-sky-400 text-sm font-semibold flex items-center gap-3 animate-in fade-in duration-500">
        <RefreshCw className="w-5 h-5 shrink-0" />
        <div>
          <p className="font-bold">Conta já conectada. Atualizamos a autorização com sucesso.</p>
          {nickname && <p className="text-xs font-medium opacity-90 mt-0.5">A conta <strong>{nickname}</strong> foi reconectada e o token renovado.</p>}
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-4 rounded-2xl border border-destructive/30 bg-destructive/5 text-destructive text-sm font-semibold flex items-center gap-3 animate-in fade-in duration-500">
        <XCircle className="w-5 h-5 shrink-0" />
        <div>
          <p className="font-bold">Falha ao conectar a conta Mercado Livre.</p>
          <p className="text-xs font-medium opacity-90 mt-0.5">{errorMsg || `Erro: ${error}`}</p>
        </div>
      </div>
    );
  }
  return null;
}

// ─── Página Principal ──────────────────────────────────────────────────────────
export default function ContasMercadoLivrePage() {
  const { accounts, refreshAccounts, connectViaOAuth } = useMeli();
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [startingSyncId, setStartingSyncId] = useState<string | null>(null);
  const [backgroundNotice, setBackgroundNotice] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const startSyncId = searchParams.get("accountId");
  const shouldStartSync = searchParams.get("start_sync") === "true";

  const loadAccounts = useCallback(async () => {
    setIsLoading(true);
    try {
      await refreshAccounts();
    } finally {
      setIsLoading(false);
    }
  }, [refreshAccounts]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    const hasSyncingAccount = accounts.some((account) => account.lastSyncStatus === "SYNCING");
    if (!hasSyncingAccount) return;

    const interval = window.setInterval(() => {
      refreshAccounts();
    }, 3500);

    return () => window.clearInterval(interval);
  }, [accounts, refreshAccounts]);

  const handleStartSync = useCallback(async (account: MeliAccount) => {
    try {
      setStartingSyncId(account.id);
      setBackgroundNotice(null);

      const res = await fetch(`/api/mercado-livre/accounts/${account.id}/sync-background`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Nao foi possivel iniciar a sincronizacao.");
      }

      setBackgroundNotice(data.message || "Sincronizacao iniciada em segundo plano.");
      await refreshAccounts();
    } catch (err: any) {
      alert(err.message || "Falha ao iniciar sincronizacao.");
    } finally {
      setStartingSyncId(null);
    }
  }, [refreshAccounts]);

  // Auto-start sync if redirected from OAuth callback
  useEffect(() => {
    if (shouldStartSync && startSyncId && accounts.length > 0) {
      const account = accounts.find(a => a.id === startSyncId);
      if (account) {
        handleStartSync(account);
        // Remove os parâmetros da URL para não ficar em loop ao recarregar a página
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [shouldStartSync, startSyncId, accounts, handleStartSync]);

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      await connectViaOAuth();
    } catch (err: any) {
      alert(err.message);
      setIsConnecting(false);
    }
  };

  return (
    <>
      <div className="space-y-8 animate-in fade-in duration-500 pb-10">
        {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-5">
        <div className="space-y-1">
          <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-foreground/90 flex items-center gap-2">
            <Link2 className="w-5 h-5 text-primary" />
            Contas Mercado Livre
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground font-medium">
            Estas são suas contas Mercado Livre conectadas. Adicione, remova, edite apelidos e sincronize dados.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => loadAccounts()} disabled={isLoading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-border/60 bg-card text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-accent transition-all cursor-pointer disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-primary" : ""}`} />
            Atualizar
          </button>
          <Button onClick={handleConnect} disabled={isConnecting} className="rounded-xl text-xs font-bold gap-2">
            <Plus className="w-3.5 h-3.5" />
            {isConnecting ? "Redirecionando..." : "Adicionar conta"}
          </Button>
        </div>
      </div>

      {/* Banner de status do OAuth (Suspense para SSR) */}
      <Suspense fallback={null}>
        <StatusBanner />
      </Suspense>

      {/* Informativo */}
      <div className="p-4 rounded-2xl border border-primary/15 bg-primary/5 text-xs text-foreground/80 font-medium leading-relaxed flex items-start gap-3">
        <Shield className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <div>
          <strong className="font-bold text-foreground">Segurança OAuth2.</strong>{" "}
          Todas as contas são conectadas via autorização oficial do Mercado Livre. Nunca armazenamos sua senha.
          Os tokens são salvos de forma segura e renovados automaticamente.
        </div>
      </div>

      {backgroundNotice && (
        <div className="rounded-2xl border border-sky-500/25 bg-sky-500/10 px-4 py-3 text-sm font-semibold text-sky-700 dark:text-sky-300">
          {backgroundNotice} Voce pode continuar usando o sistema enquanto o Datex trabalha.
        </div>
      )}

      {/* Loading */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2].map((i) => (
            <div key={i} className="rounded-2xl border border-border/60 p-5 bg-card space-y-4">
              <div className="flex items-center gap-3">
                <Skeleton className="w-11 h-11 rounded-xl" />
                <div className="space-y-1.5 flex-1"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-20" /></div>
              </div>
              <div className="grid grid-cols-3 gap-2">{[1,2,3].map(j => <Skeleton key={j} className="h-16 rounded-xl" />)}</div>
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-9 rounded-xl" />
            </div>
          ))}
        </div>
      ) : accounts.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center p-16 border border-dashed border-border/60 rounded-2xl bg-card/40 text-center gap-5">
          <div className="p-5 rounded-full bg-primary/10">
            <Link2 className="w-10 h-10 text-primary" />
          </div>
          <div className="space-y-2 max-w-md">
            <h3 className="text-lg font-bold text-foreground">Nenhuma conta conectada</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Conecte sua conta do Mercado Livre via OAuth oficial para começar a sincronizar
              anúncios, vendas, perguntas e métricas de reputação.
            </p>
          </div>
          <div className="flex flex-col items-center gap-3">
            <Button onClick={handleConnect} disabled={isConnecting} className="gap-2 rounded-xl font-bold px-6">
              <ExternalLink className="w-4 h-4" />
              {isConnecting ? "Redirecionando para o Mercado Livre..." : "Conectar conta Mercado Livre"}
            </Button>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
              <Shield className="w-3 h-3 text-primary" />
              Você será redirecionado para a autorização oficial do Mercado Livre.
            </p>
          </div>
        </div>
      ) : (
        /* Grid de contas */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              onRefresh={loadAccounts}
              onStartSync={handleStartSync}
              isStartingSync={startingSyncId === account.id}
            />
          ))}
          {/* Card para adicionar nova conta */}
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="rounded-2xl border border-dashed border-border/60 bg-card/20 hover:bg-card/60 hover:border-primary/30 transition-all p-8 flex flex-col items-center justify-center gap-3 text-center cursor-pointer disabled:opacity-60 group"
          >
            <div className="p-4 rounded-full bg-primary/10 group-hover:bg-primary/15 transition-colors">
              <Plus className="w-7 h-7 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground/80">Adicionar conta</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {isConnecting ? "Redirecionando..." : "Autorização via Mercado Livre"}
              </p>
            </div>
          </button>
        </div>
      )}
    </div>
    </>
  );
}
