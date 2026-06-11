"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingBag,
  TrendingUp,
  Award,
  Cpu,
  X,
  Layers,
  Settings,
  Link2,
  ChevronDown,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  className?: string;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export function Sidebar({ className, isOpenMobile, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();

  const menuItems = [
    { name: "DASHBOARD", href: "/dashboard", icon: LayoutDashboard },
    { name: "ANÚNCIOS", href: "/anuncios", icon: ShoppingBag },
    { name: "VENDAS", href: "/vendas", icon: TrendingUp },
    { name: "REPUTAÇÃO", href: "/reputacao", icon: Award },
    { name: "INTELIGÊNCIA ARTIFICIAL", href: "/ia", icon: Cpu },
  ];

  const configSubItems = [
    { name: "Diagnóstico", href: "/configuracoes", icon: Activity },
    { name: "Contas Mercado Livre", href: "/configuracoes/contas-mercado-livre", icon: Link2 },
  ];

  const isConfigActive = pathname.startsWith("/configuracoes");
  const [configOpen, setConfigOpen] = useState(isConfigActive);

  const sidebarContent = (
    <div className="flex h-full flex-col border-r border-border/50 bg-card/75 shadow-xl shadow-background/50 backdrop-blur-2xl">
      <div className="flex items-center justify-between border-b border-border/40 px-6 py-6">
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-primary to-indigo-500 text-xl font-black text-white shadow-lg shadow-primary/35 transition-transform group-hover:rotate-3 group-hover:scale-105">
            D
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-extrabold leading-none tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground via-foreground/90 to-foreground/80">
              Datex
            </span>
            <span className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-primary opacity-90">
              MeliOps SaaS
            </span>
          </div>
        </Link>
        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="rounded-lg p-1.5 text-muted-foreground transition-all hover:bg-accent/60 hover:text-foreground md:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-2 overflow-y-auto px-4 py-6">
        <div className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">
          Módulos de Gestão
        </div>
        {menuItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onCloseMobile}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-4 py-3 text-[13px] font-medium tracking-wide transition-all duration-200",
                isActive
                  ? "bg-gradient-to-r from-primary to-indigo-600 font-semibold text-white shadow-md shadow-primary/25"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              )}
            >
              {isActive && <span className="absolute left-0 top-1/4 bottom-1/4 w-1 rounded-r-md bg-white" />}
              <Icon
                className={cn(
                  "h-4.5 w-4.5 shrink-0 transition-transform duration-300 group-hover:scale-110",
                  isActive ? "text-white" : "text-muted-foreground group-hover:text-foreground"
                )}
              />
              <span className="truncate">{item.name}</span>
            </Link>
          );
        })}

        <div className="mt-3 border-t border-border/30 pt-3">
          <div className="mb-1 px-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
            Sistema
          </div>

          <button
            onClick={() => setConfigOpen((value) => !value)}
            className={cn(
              "group relative flex w-full items-center justify-between rounded-xl px-4 py-3 text-[13px] font-medium tracking-wide transition-all duration-200",
              isConfigActive
                ? "bg-gradient-to-r from-primary to-indigo-600 font-semibold text-white shadow-md shadow-primary/25"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
            )}
          >
            <span className="flex items-center gap-3">
              {isConfigActive && <span className="absolute left-0 top-1/4 bottom-1/4 w-1 rounded-r-md bg-white" />}
              <Settings
                className={cn(
                  "h-4.5 w-4.5 shrink-0 transition-transform duration-300 group-hover:scale-110",
                  isConfigActive ? "text-white" : "text-muted-foreground group-hover:text-foreground"
                )}
              />
              <span>CONFIGURACOES</span>
            </span>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 transition-transform duration-200",
                configOpen ? "rotate-180" : "",
                isConfigActive ? "text-white/70" : "text-muted-foreground/50"
              )}
            />
          </button>

          {configOpen && (
            <div className="mt-1 space-y-0.5 border-l border-border/40 pl-3 ml-4">
              {configSubItems.map((item) => {
                const isSubActive = pathname === item.href;
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onCloseMobile}
                    className={cn(
                      "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-[12px] font-medium transition-all duration-150",
                      isSubActive
                        ? "bg-primary/10 font-semibold text-primary"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-3.5 w-3.5 shrink-0",
                        isSubActive ? "text-primary" : "text-muted-foreground/70 group-hover:text-foreground"
                      )}
                    />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </nav>

      <div className="border-t border-border/40 p-4 text-center">
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border/30 bg-secondary/50 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground shadow-inner">
          <Layers className="h-3.5 w-3.5 text-primary animate-pulse" />
          <span>Core Engine v2.5</span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className={cn("hidden md:block fixed left-0 top-0 z-20 h-screen w-64", className)}>
        {sidebarContent}
      </aside>

      {isOpenMobile && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={onCloseMobile} />
          <aside className="relative z-50 h-full w-64 animate-in slide-in-from-left duration-300">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
