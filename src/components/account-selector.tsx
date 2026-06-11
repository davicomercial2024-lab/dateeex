"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  ChevronDown, Plus, Check, Layers, AlertTriangle, Clock, Wifi, Settings,
} from "lucide-react";
import { useMeli, MeliAccount } from "@/context/meli-context";
import { SyncProgress } from "@/components/sync-progress";
import Link from "next/link";

// Ícone de status colorido por conta
function StatusDot({ status }: { status: MeliAccount["status"] }) {
  if (status === "CONNECTED") {
    return (
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
      </span>
    );
  }
  if (status === "EXPIRED") {
    return <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />;
  }
  if (status === "DISCONNECTED") {
    return <span className="w-2 h-2 rounded-full bg-muted-foreground/40 shrink-0 inline-block" />;
  }
  // ERROR
  return <span className="w-2 h-2 rounded-full bg-destructive shrink-0 inline-block" />;
}

export function AccountSelector() {
  const {
    accounts,
    selectedAccountId,
    selectedAccount,
    setSelectedAccountId,
    syncProgress,
    connectViaOAuth,
  } = useMeli();

  const [isOpen, setIsOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectError, setConnectError] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (id: string) => {
    setSelectedAccountId(id);
    setIsOpen(false);
  };

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      setConnectError("");
      await connectViaOAuth(); // Redireciona — não retorna
    } catch (err: any) {
      setConnectError(err.message || "Falha ao iniciar autorização OAuth.");
      setIsConnecting(false);
    }
  };

  // Label do trigger
  const triggerLabel = selectedAccountId === "all"
    ? "Todas as contas"
    : (selectedAccount?.displayName ?? selectedAccount?.nickname ?? "Conta selecionada");

  const triggerStatus = selectedAccountId !== "all" ? selectedAccount?.status : null;
  const syncingAccounts = accounts.filter((account) => account.lastSyncStatus === "SYNCING");

  return (
    <div className="relative" ref={containerRef}>
      {/* Botão do seletor */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl border border-border bg-card/65 backdrop-blur-md hover:bg-accent/80 hover:text-foreground text-xs font-bold transition-all shadow-sm focus:outline-none focus:ring-1 focus:ring-primary/40 cursor-pointer text-left w-[200px] justify-between hover:scale-[1.01] active:scale-[0.99]"
      >
        <span className="flex items-center gap-2 truncate">
          {selectedAccountId === "all" ? (
            <>
              <Layers className="w-4 h-4 text-primary shrink-0" />
              <span className="truncate tracking-wide uppercase text-[10px]">Todas as contas</span>
            </>
          ) : (
            <>
              {triggerStatus && <StatusDot status={triggerStatus} />}
              <span className="truncate tracking-wide font-bold text-foreground/90 uppercase text-[10px]">
                {triggerLabel}
              </span>
            </>
          )}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2.5 w-[260px] rounded-xl border border-border/50 bg-card/95 shadow-xl shadow-background/40 z-50 p-2 animate-in fade-in slide-in-from-top-2 duration-200 backdrop-blur-xl">
          {/* Cabeçalho */}
          <div className="px-3 py-2 border-b border-border/40 mb-1.5 text-[10px] font-bold text-muted-foreground/80 tracking-widest uppercase bg-secondary/35 rounded-lg">
            Contas Mercado Livre
          </div>

          {/* Opção: Todas as contas */}
          {syncingAccounts.length > 0 && (
            <div className="mb-1.5 rounded-lg border border-sky-500/20 bg-sky-500/5 p-2">
              <SyncProgress
                compact
                progress={syncProgress}
                label={
                  syncingAccounts.length === 1
                    ? `Sincronizando ${syncingAccounts[0].displayName}`
                    : `Sincronizando ${syncingAccounts.length} contas`
                }
              />
            </div>
          )}

          <button
            onClick={() => handleSelect("all")}
            className="flex items-center justify-between w-full px-3 py-2.5 text-xs rounded-lg font-medium text-left hover:bg-accent hover:text-accent-foreground transition-all cursor-pointer mb-0.5"
          >
            <span className="flex items-center gap-2.5">
              <Layers className="w-4 h-4 text-primary" />
              <span className="font-semibold text-foreground/95">Todas as contas</span>
              {accounts.length > 0 && (
                <span className="text-[9px] text-muted-foreground font-medium">({accounts.length})</span>
              )}
            </span>
            {selectedAccountId === "all" && <Check className="w-4 h-4 text-primary" />}
          </button>

          {/* Lista de contas ativas */}
          {accounts.length > 0 ? (
            <div className="max-h-[200px] overflow-y-auto border-b border-border/40 py-1 mb-1.5 space-y-0.5">
              {accounts.map((acc) => (
                <button
                  key={acc.id}
                  onClick={() => handleSelect(acc.id)}
                  className="flex items-center justify-between w-full px-3 py-2 text-xs rounded-lg text-left hover:bg-accent hover:text-accent-foreground transition-all cursor-pointer"
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <StatusDot status={acc.status} />
                    <span className="flex flex-col min-w-0">
                      <span className="truncate text-foreground/90 font-semibold text-[11px] uppercase">
                        {acc.displayName}
                      </span>
                      {acc.nicknameCustom && (
                        <span className="text-[9px] text-muted-foreground font-medium truncate">
                          {acc.nickname}
                        </span>
                      )}
                    </span>
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {acc.lastSyncStatus === "SYNCING" && (
                      <Clock className="w-3 h-3 text-amber-500 animate-pulse" />
                    )}
                    {acc.status === "EXPIRED" && (
                      <AlertTriangle className="w-3 h-3 text-amber-500" />
                    )}
                    {selectedAccountId === acc.id && (
                      <Check className="w-4 h-4 text-primary" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="px-3 py-4 text-center text-[11px] text-muted-foreground border-b border-border/40 mb-1.5">
              Nenhuma conta conectada.
            </div>
          )}

          {/* Erro de conexão */}
          {connectError && (
            <p className="px-3 pb-1 text-[10px] text-destructive font-semibold">{connectError}</p>
          )}

          {/* Botão de adicionar */}
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="flex items-center gap-2.5 w-full px-3 py-2.5 text-xs rounded-lg hover:bg-primary/10 hover:text-primary text-primary/95 font-bold transition-all cursor-pointer disabled:opacity-60"
          >
            <Plus className="w-4 h-4" />
            <span>{isConnecting ? "Redirecionando..." : "Adicionar conta Mercado Livre"}</span>
          </button>

          {/* Link para gerenciamento */}
          <Link
            href="/configuracoes/contas-mercado-livre"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-[10px] rounded-lg hover:bg-accent/60 text-muted-foreground hover:text-foreground font-medium transition-all cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Gerenciar contas</span>
          </Link>
        </div>
      )}
    </div>
  );
}
