"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  TrendingUp, RefreshCw, AlertTriangle, Package,
  Clock, Truck, CheckCircle2, XCircle, ShoppingCart,
} from "lucide-react";
import { useMeli } from "@/context/meli-context";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ─── Tipos ──────────────────────────────────────────────────────────────────
interface OrderItem { mlItemId: string; title: string; quantity: number; unitPrice: number | string; }
interface Order {
  id: string;
  mlOrderId: string;
  status: string;
  totalAmount: number | string;
  buyerNickname: string;
  dateCreated: string;
  orderItems: OrderItem[];
  mercadoLivreAccount?: { nickname: string };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatBRL = (v: number | string) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v));
const formatDate = (d: string) =>
  new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });

const STATUS_ORDER: Record<string, { label: string; cls: string; Icon: React.ElementType }> = {
  paid:       { label: "Pago",       cls: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20", Icon: CheckCircle2 },
  confirmed:  { label: "Confirmado", cls: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20", Icon: CheckCircle2 },
  shipped:    { label: "Enviado",    cls: "bg-sky-500/10 text-sky-500 border-sky-500/20",             Icon: Truck },
  delivered:  { label: "Entregue",   cls: "bg-teal-500/10 text-teal-500 border-teal-500/20",         Icon: Package },
  cancelled:  { label: "Cancelado",  cls: "bg-destructive/10 text-destructive border-destructive/20", Icon: XCircle },
};
function orderBadge(s: string) {
  const m = STATUS_ORDER[s] || { label: s || "Pendente", cls: "bg-amber-500/10 text-amber-500 border-amber-500/20", Icon: Clock };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${m.cls}`}>
      <m.Icon className="w-3 h-3" /> {m.label}
    </span>
  );
}
function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`rounded-lg bg-muted animate-pulse ${className}`} />;
}

export default function VendasPage() {
  const { accounts, selectedAccountId, selectedAccount, isSyncing, triggerSync } = useMeli();

  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async (accountId: string) => {
    setIsLoading(true);
    setError(null);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const res = await fetch(`/api/orders?accountId=${accountId}&limit=100`, { signal: controller.signal });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao carregar vendas.");
      setOrders(data.orders || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      if (err.name !== "AbortError") setError(err.message || "Erro desconhecido.");
      else setError("A requisição demorou mais de 30 segundos. Tente novamente.");
    } finally {
      clearTimeout(timeout);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (accounts.length > 0) fetchOrders(selectedAccountId);
  }, [selectedAccountId, accounts.length, fetchOrders]);

  if (accounts.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-foreground/90">Gestão de Vendas</h1>
          <p className="text-xs md:text-sm text-muted-foreground font-medium">Acompanhe pedidos e faturamento em tempo real.</p>
        </div>
        <EmptyState title="Nenhuma conta conectada" description="Vincule sua conta do Mercado Livre para visualizar vendas, pedidos e logística." icon={TrendingUp} pageName="Vendas" />
      </div>
    );
  }

  // Cálculos de resumo
  const today = new Date().toISOString().slice(0, 10);
  const ordersToday = orders.filter(o => o.dateCreated.slice(0, 10) === today && o.status !== "cancelled").length;
  const totalRevenue = orders.filter(o => o.status !== "cancelled").reduce((s, o) => s + Number(o.totalAmount), 0);
  const cancelledCount = orders.filter(o => o.status === "cancelled").length;

  const accountLabel = selectedAccountId === "all"
    ? `${accounts.length} conta(s) consolidada(s)` : (selectedAccount?.nickname ?? "");

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-5">
        <div className="space-y-1">
          <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-foreground/90">Gestão de Vendas</h1>
          <p className="text-xs md:text-sm text-muted-foreground font-medium">{accountLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fetchOrders(selectedAccountId)} disabled={isLoading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-border/60 bg-card text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-accent transition-all cursor-pointer disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-primary" : ""}`} />
            Atualizar
          </button>
          <Button onClick={async () => { await triggerSync(); await fetchOrders(selectedAccountId); }}
            disabled={isSyncing || isLoading} size="sm" className="rounded-xl text-xs font-bold gap-2">
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "Sincronizando..." : "Sincronizar agora"}
          </Button>
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border/60 p-5 bg-card">
            <Skeleton className="h-3 w-24 mb-3" /><Skeleton className="h-7 w-20" />
          </div>
        )) : (
          <>
            {[
              { label: "Total de Pedidos",   value: total.toLocaleString("pt-BR"),            Icon: ShoppingCart },
              { label: "Faturamento Total",  value: formatBRL(totalRevenue),                  Icon: TrendingUp },
              { label: "Pedidos Hoje",       value: ordersToday.toLocaleString("pt-BR"),      Icon: Clock },
              { label: "Cancelados",         value: cancelledCount.toLocaleString("pt-BR"),   Icon: XCircle, alert: cancelledCount > 0 },
            ].map((c) => (
              <div key={c.label} className={`rounded-2xl border p-5 bg-card ${c.alert ? "border-destructive/20" : "border-border/60"}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{c.label}</span>
                  <div className={`p-2 rounded-xl ${c.alert ? "bg-destructive/10" : "bg-primary/10"}`}>
                    <c.Icon className={`w-3.5 h-3.5 ${c.alert ? "text-destructive" : "text-primary"}`} />
                  </div>
                </div>
                <p className="text-2xl font-black text-foreground">{c.value}</p>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Erro */}
      {error && (
        <div className="p-4 rounded-2xl border border-destructive/30 bg-destructive/5 text-destructive text-xs font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
          <button onClick={() => fetchOrders(selectedAccountId)} className="ml-auto underline cursor-pointer">Tentar novamente</button>
        </div>
      )}

      {/* Tabela / Empty */}
      {isLoading ? (
        <div className="border border-border/60 rounded-2xl overflow-hidden bg-card">
          <div className="px-4 py-3 bg-secondary/30 border-b border-border/40 grid grid-cols-12 gap-4">
            {["col-span-4","col-span-2","col-span-2","col-span-2","col-span-2"].map((c,i) => (
              <Skeleton key={i} className={`h-3 ${c}`} />
            ))}
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="px-4 py-4 grid grid-cols-12 gap-4 items-center border-b border-border/30">
              <div className="col-span-4 flex items-center gap-3">
                <Skeleton className="w-9 h-9 rounded-xl shrink-0" />
                <div className="space-y-1.5 w-full"><Skeleton className="h-3 w-3/4" /><Skeleton className="h-2 w-1/2" /></div>
              </div>
              <Skeleton className="col-span-2 h-3" />
              <Skeleton className="col-span-2 h-3" />
              <Skeleton className="col-span-2 h-3" />
              <Skeleton className="col-span-2 h-5 rounded-full" />
            </div>
          ))}
        </div>
      ) : orders.length === 0 && !error ? (
        <div className="flex flex-col items-center justify-center p-12 border border-dashed border-border/60 rounded-2xl bg-card/40 text-center gap-4">
          <div className="p-4 rounded-full bg-primary/10"><TrendingUp className="w-8 h-8 text-primary" /></div>
          <div>
            <h3 className="text-base font-bold text-foreground mb-1">Nenhuma venda sincronizada</h3>
            <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
              Sua conta está conectada, mas ainda não encontramos pedidos. Clique em "Sincronizar agora" para importar suas vendas.
            </p>
          </div>
          <Button onClick={async () => { await triggerSync(); await fetchOrders(selectedAccountId); }} disabled={isSyncing} className="gap-2 rounded-xl font-bold">
            <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "Sincronizando..." : "Sincronizar agora"}
          </Button>
        </div>
      ) : (
        <div className="border border-border/60 rounded-2xl overflow-hidden bg-card shadow-sm">
          <div className="px-4 py-3 bg-secondary/30 border-b border-border/40 text-[10px] font-bold text-muted-foreground uppercase tracking-widest grid grid-cols-12 gap-4">
            <div className="col-span-4">Comprador</div>
            <div className="col-span-2 text-center">Pedido</div>
            <div className="col-span-2 text-center">Itens</div>
            <div className="col-span-2 text-center">Valor Total</div>
            <div className="col-span-2 text-center">Status / Data</div>
          </div>
          <div className="divide-y divide-border/30">
            {orders.map((order) => (
              <div key={order.id} className="px-4 py-3 grid grid-cols-12 gap-4 items-center hover:bg-accent/30 transition-colors">
                <div className="col-span-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 shrink-0 flex items-center justify-center font-black text-xs text-primary">
                    {order.buyerNickname.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{order.buyerNickname}</p>
                    {order.mercadoLivreAccount && selectedAccountId === "all" && (
                      <p className="text-[10px] text-muted-foreground">{order.mercadoLivreAccount.nickname}</p>
                    )}
                  </div>
                </div>
                <div className="col-span-2 text-center">
                  <span className="text-[10px] font-mono text-muted-foreground">{order.mlOrderId}</span>
                </div>
                <div className="col-span-2 text-center text-xs font-semibold text-foreground">
                  {order.orderItems.length}
                </div>
                <div className="col-span-2 text-center text-xs font-bold text-foreground">
                  {formatBRL(order.totalAmount)}
                </div>
                <div className="col-span-2 text-center space-y-1">
                  {orderBadge(order.status)}
                  <p className="text-[10px] text-muted-foreground">{formatDate(order.dateCreated)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isLoading && orders.length > 0 && (
        <p className="text-[10px] text-muted-foreground text-center">
          Mostrando {orders.length} de {total} pedido(s)
        </p>
      )}
    </div>
  );
}
