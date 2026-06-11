"use client";

import React, { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Menu,
  Sun,
  Moon,
  LogOut,
  User,
  Settings,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { AccountSelector } from "@/components/account-selector";
import { SyncProgress } from "@/components/sync-progress";
import { useMeli } from "@/context/meli-context";
import { cn } from "@/lib/utils";

interface TopbarProps {
  user: { name: string; email: string; role: string } | null;
  organization: { id: string; name: string } | null;
  onOpenMobileSidebar: () => void;
}

export function Topbar({ user, organization, onOpenMobileSidebar }: TopbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { accounts, selectedAccountId, isSyncing, syncProgress, triggerSync } = useMeli();
  const syncingAccounts = accounts.filter((account) => account.lastSyncStatus === "SYNCING");

  const [mounted, setMounted] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [toast, setToast] = useState<{
    show: boolean;
    type: "success" | "error";
    title: string;
    description: string;
  }>({
    show: false,
    type: "success",
    title: "",
    description: "",
  });

  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getPageTitle = () => {
    if (pathname === "/configuracoes") return "Diagnostico";
    if (pathname === "/configuracoes/contas-mercado-livre") return "Contas Mercado Livre";
    if (pathname === "/promocoes") return "Promocoes";
    if (pathname.startsWith("/promocoes")) return "Promocoes";
    if (pathname.startsWith("/configuracoes")) return "Configuracoes";

    const route = pathname.split("/")[1] || "";
    switch (route.toLowerCase()) {
      case "dashboard":
        return "Dashboard";
      case "anuncios":
        return "Anuncios";
      case "vendas":
        return "Vendas";
      case "reputacao":
        return "Reputacao";
      case "publicidade":
        return "Publicidade";
      case "ia":
        return "Inteligencia Artificial";
      default:
        return "Datex";
    }
  };

  const handleLogout = async () => {
    try {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
      });

      if (res.ok) {
        localStorage.removeItem("datex_logged_in");
        router.push("/login");
      } else {
        alert("Erro ao efetuar logout. Tente novamente.");
      }
    } catch (err) {
      console.error("Erro no logout:", err);
      alert("Erro de conexao ao efetuar logout.");
    }
  };

  const handleSync = async () => {
    if (isSyncing) return;

    try {
      await triggerSync();
      setToast({
        show: true,
        type: "success",
        title: "Sincronizacao concluida",
        description:
          selectedAccountId === "all"
            ? "Todas as contas integradas foram atualizadas com o banco PostgreSQL local."
            : "A conta selecionada foi sincronizada no banco local.",
      });
    } catch (err: any) {
      setToast({
        show: true,
        type: "error",
        title: "Falha na sincronizacao",
        description: err.message || "Erro desconhecido ao acessar a API do Mercado Livre.",
      });
    }

    setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false }));
    }, 6000);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border/40 bg-card/70 shadow-sm backdrop-blur-md">
      {toast.show && (
        <div className="fixed left-1/2 top-4 z-50 flex w-[90%] max-w-[420px] -translate-x-1/2 items-start gap-3 rounded-2xl border border-border bg-card/95 p-4 shadow-2xl shadow-background/50 backdrop-blur-xl animate-in fade-in slide-in-from-top-4 duration-300">
          {toast.type === "success" ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
          ) : (
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          )}
          <div className="space-y-1">
            <h4
              className={cn(
                "text-xs font-black uppercase tracking-wider",
                toast.type === "success" ? "text-emerald-500" : "text-destructive"
              )}
            >
              {toast.title}
            </h4>
            <p className="text-[11px] font-semibold leading-relaxed text-foreground/90">
              {toast.description}
            </p>
            <p className="pt-1 text-[9px] text-muted-foreground">
              Dados consolidados com seguranca em {new Date().toLocaleTimeString("pt-BR")}.
            </p>
          </div>
          <button
            onClick={() => setToast((prev) => ({ ...prev, show: false }))}
            className="ml-auto cursor-pointer pl-2 text-xs font-bold text-muted-foreground hover:text-foreground"
          >
            X
          </button>
        </div>
      )}

      <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-4">
          <button
            onClick={onOpenMobileSidebar}
            className="cursor-pointer rounded-xl p-2 -ml-2 text-muted-foreground transition-all hover:bg-accent/60 hover:text-foreground md:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          <h1 className="text-sm font-extrabold uppercase tracking-widest bg-clip-text text-transparent bg-gradient-to-r from-foreground via-foreground/90 to-foreground/70 md:text-base">
            {getPageTitle()}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {accounts.length > 0 && (
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className={cn(
                "shrink-0 flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-card/40 shadow-sm transition-all hover:scale-105 hover:bg-accent/80 hover:text-foreground active:scale-95 disabled:cursor-not-allowed disabled:opacity-50",
                isSyncing && "border-primary/40 bg-primary/5"
              )}
              title="Sincronizar dados agora"
            >
              <RefreshCw className={cn("h-4.5 w-4.5 text-primary", isSyncing && "animate-spin")} />
            </button>
          )}

          <AccountSelector />

          {mounted && (
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-card/40 shadow-sm transition-all hover:scale-105 hover:bg-accent/80 hover:text-foreground active:scale-95"
              title="Alternar tema"
            >
              {theme === "dark" ? (
                <Sun className="h-4.5 w-4.5 text-amber-500 transition-transform duration-500 hover:rotate-45" />
              ) : (
                <Moon className="h-4.5 w-4.5 text-indigo-600 transition-transform duration-500 hover:-rotate-12" />
              )}
            </button>
          )}

          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setIsProfileOpen((value) => !value)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-gradient-to-tr from-primary/10 to-indigo-500/10 text-sm font-bold text-primary shadow-sm transition-all hover:scale-105 hover:border-primary/40"
            >
              {user ? user.name.charAt(0).toUpperCase() : "U"}
            </button>

            {isProfileOpen && (
              <div className="absolute right-0 z-50 mt-2.5 w-[220px] rounded-xl border border-border/50 bg-card/95 p-2 shadow-xl shadow-background/50 backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="mb-1.5 rounded-lg border-b border-border/40 bg-secondary/30 px-3 py-2.5">
                <p className="truncate text-xs font-bold text-foreground">{user ? user.name : "Carregando..."}</p>
                <p className="mt-0.5 truncate text-[10px] font-medium text-muted-foreground">
                  {user ? user.email : "..."}
                </p>
              </div>

              <button
                onClick={() => {
                  alert(`Organizacao: ${organization?.name || "Datex"}\nFuncao: ${user?.role === "ADMIN" ? "Administrador" : "Membro"}`);
                  setIsProfileOpen(false);
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition-all hover:bg-accent hover:text-foreground"
              >
                <User className="h-4 w-4 text-primary" />
                <span>Organizacao</span>
              </button>

              <button
                onClick={() => {
                  alert(`Configuracoes de ${organization?.name || "Datex"}`);
                  setIsProfileOpen(false);
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition-all hover:bg-accent hover:text-foreground"
              >
                <Settings className="h-4 w-4 text-primary" />
                <span>Configuracoes</span>
              </button>

              <div className="my-1.5 border-t border-border/40" />

              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-destructive transition-all hover:bg-destructive/10"
              >
                <LogOut className="h-4 w-4" />
                <span>Sair do Datex</span>
              </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {syncingAccounts.length > 0 && (
        <div className="border-t border-border/40 bg-card/85 px-4 py-3 sm:px-6">
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
    </header>
  );
}
