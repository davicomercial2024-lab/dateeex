"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

export interface MeliAccount {
  id: string;
  meliUserId: string;
  nickname: string;
  nicknameCustom: string | null;
  displayName: string;
  email: string | null;
  siteId: string | null;
  countryId: string | null;
  status: "CONNECTED" | "EXPIRED" | "ERROR" | "DISCONNECTED";
  isActive: boolean;
  isDefault: boolean;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSyncProgress: number;
  lastSyncError: string | null;
  connectedAt: string;
  disconnectedAt: string | null;
  counts: {
    listings: number;
    orders: number;
    questions: number;
  };
}

interface MeliContextType {
  accounts: MeliAccount[];
  selectedAccountId: string;
  selectedAccount: MeliAccount | null;
  setSelectedAccountId: (id: string) => void;
  isSyncing: boolean;
  syncProgress: number;
  syncReport: unknown | null;
  triggerSync: () => Promise<void>;
  refreshAccounts: () => Promise<void>;
  connectViaOAuth: () => Promise<void>;
}

const MeliContext = createContext<MeliContextType | undefined>(undefined);

export function MeliProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [accounts, setAccounts] = useState<MeliAccount[]>([]);
  const [selectedAccountId, setSelectedAccountIdState] = useState<string>("all");
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncReport, setSyncReport] = useState<unknown | null>(null);

  const refreshAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/mercado-livre/accounts", { cache: "no-store" });
      if (!res.ok) return;

      const data = await res.json();
      if (data.success && Array.isArray(data.accounts)) {
        const activeAccounts: MeliAccount[] = data.accounts;
        setAccounts(activeAccounts);

        const stored = localStorage.getItem("datex_selected_account_id");
        if (stored === "all" || activeAccounts.some((a) => a.id === stored)) {
          setSelectedAccountIdState(stored ?? "all");
        } else {
          setSelectedAccountIdState("all");
          localStorage.setItem("datex_selected_account_id", "all");
        }
      }
    } catch (err) {
      console.error("[MeliContext] Erro ao carregar contas:", err);
    }
  }, []);

  useEffect(() => {
    refreshAccounts();
  }, [refreshAccounts]);

  useEffect(() => {
    const hasSyncingAccount = accounts.some((account) => account.lastSyncStatus === "SYNCING");
    if (!hasSyncingAccount) return;

    const interval = window.setInterval(() => {
      refreshAccounts();
    }, 3500);

    return () => window.clearInterval(interval);
  }, [accounts, refreshAccounts]);

  const setSelectedAccountId = (id: string) => {
    setSelectedAccountIdState(id);
    localStorage.setItem("datex_selected_account_id", id);
  };

  const connectViaOAuth = async () => {
    const res = await fetch("/api/mercado-livre/auth-url");
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Nao foi possivel obter a URL de autorizacao.");
    }

    const data = await res.json();
    if (data.success && data.url) {
      window.location.href = data.url;
    } else {
      throw new Error("URL de autorizacao invalida.");
    }
  };

  const triggerSync = async () => {
    let pollInterval: number | null = null;

    try {
      setIsSyncing(true);
      setSyncReport(null);
      await refreshAccounts();

      pollInterval = window.setInterval(() => {
        refreshAccounts();
      }, 700);

      const res = await fetch("/api/mercado-livre/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: selectedAccountId }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Erro ao processar sincronizacao.");
      }

      const data = await res.json();
      setSyncReport(data);
      await refreshAccounts();
    } catch (err) {
      console.error("[MeliContext] Erro na sincronizacao:", err);
      throw err;
    } finally {
      setIsSyncing(false);
      if (pollInterval !== null) {
        window.clearInterval(pollInterval);
      }
    }
  };

  const selectedAccount = accounts.find((acc) => acc.id === selectedAccountId) ?? null;
  const syncingAccounts = accounts.filter((account) => account.lastSyncStatus === "SYNCING");
  const syncProgress =
    syncingAccounts.length > 0
      ? Math.max(...syncingAccounts.map((account) => account.lastSyncProgress ?? 0))
      : 0;

  return (
    <MeliContext.Provider
      value={{
        accounts,
        selectedAccountId,
        selectedAccount,
        setSelectedAccountId,
        isSyncing,
        syncProgress,
        syncReport,
        triggerSync,
        refreshAccounts,
        connectViaOAuth,
      }}
    >
      {children}
    </MeliContext.Provider>
  );
}

export function useMeli() {
  const context = useContext(MeliContext);
  if (context === undefined) {
    throw new Error("useMeli deve ser usado dentro de MeliProvider");
  }
  return context;
}
