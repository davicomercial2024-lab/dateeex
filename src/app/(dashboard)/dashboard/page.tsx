"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  TrendingUp,
  ShoppingCart,
  DollarSign,
  Receipt,
  Tag,
  PauseCircle,
  MessageCircleQuestion,
  AlertTriangle,
  XCircle,
  Truck,
  Megaphone,
  BarChart2,
  Star,
  RefreshCw,
  LayoutDashboard,
  ChevronRight,
  Info,
  CalendarDays,
} from "lucide-react";
import { useMeli } from "@/context/meli-context";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

// ─────────────────────────────────────────────
// Tipos da API
// ─────────────────────────────────────────────
interface DashboardCards {
  salesToday: number;
  revenueToday: number;
  avgTicket: number;
  ordersTotal: number;
  activeListings: number;
  pausedListings: number;
  pendingQuestions: number;
  activeClaims: number;
  cancelledOrders: number;
  lateShipments: number;
  activePromotions: number;
  activeCampaigns: number;
  reputation: {
    levelId: string | null;
    powerSellerStatus: string | null;
    claimsRate: number;
    cancellationsRate: number;
    delayedHandlingTimeRate: number;
    salesCompleted: number;
  } | null;
}

interface DashboardCharts {
  revenueByDay: Array<{ date: string; revenue: number }>;
  salesByDay: Array<{ date: string; count: number }>;
  listingsByStatus: Array<{ status: string; count: number }>;
  performanceByAccount: Array<{ nickname: string; revenue: number; orders: number }>;
  promotionsByStatus: Array<{ status: string; count: number }>;
}

interface DashboardData {
  cards: DashboardCards;
  charts: DashboardCharts;
}

// ─────────────────────────────────────────────
// Utilitários de formatação PT-BR
// ─────────────────────────────────────────────
const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const formatNumber = (value: number) =>
  new Intl.NumberFormat("pt-BR").format(value);

const formatPercent = (rate: number) =>
  `${(rate * 100).toFixed(2).replace(".", ",")}%`;

const formatShortDate = (dateStr: string) => {
  const [, month, day] = dateStr.split("-");
  return `${day}/${month}`;
};

// ─────────────────────────────────────────────
// Mapeamento de reputação ML
// ─────────────────────────────────────────────
const REPUTATION_MAP: Record<string, { label: string; color: string; bg: string }> = {
  "5_green":   { label: "Verde — Excelente", color: "#10b981", bg: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
  "4_light_green": { label: "Verde Claro — Bom", color: "#6ee7b7", bg: "bg-teal-500/10 text-teal-500 border-teal-500/20" },
  "3_yellow":  { label: "Amarelo — Regular", color: "#f59e0b", bg: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
  "2_orange":  { label: "Laranja — Ruim", color: "#f97316", bg: "bg-orange-500/10 text-orange-500 border-orange-500/20" },
  "1_red":     { label: "Vermelho — Crítico", color: "#ef4444", bg: "bg-red-500/10 text-red-500 border-red-500/20" },
};

const PROMOTION_STATUS_LABELS: Record<string, string> = {
  active: "Ativas",
  pending: "Pendentes",
  finished: "Encerradas",
};

const LISTING_STATUS_LABELS: Record<string, string> = {
  active: "Ativos",
  paused: "Pausados",
  closed: "Encerrados",
  under_review: "Em Revisão",
};

// Paleta de cores consistente e visualmente rica
const CHART_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];
const PERIOD_OPTIONS = [
  { value: "1", label: "Hoje" },
  { value: "7", label: "7 dias" },
  { value: "30", label: "30 dias" },
  { value: "60", label: "60 dias" },
  { value: "custom", label: "Data" },
];

const todayInputValue = () => new Date().toISOString().slice(0, 10);

// ─────────────────────────────────────────────
// Skeleton loader
// ─────────────────────────────────────────────
function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-lg bg-muted animate-pulse ${className}`}
    />
  );
}

// ─────────────────────────────────────────────
// Metric Card Component
// ─────────────────────────────────────────────
interface MetricCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  color?: string;
  tooltip?: string;
  alert?: boolean;
}

function MetricCard({ icon: Icon, label, value, sub, color = "text-primary", tooltip, alert }: MetricCardProps) {
  return (
    <div
      className={`relative group flex flex-col gap-3 rounded-2xl border p-5 bg-card transition-all hover:shadow-md hover:-translate-y-0.5 ${
        alert ? "border-destructive/30 bg-destructive/5" : "border-border/60 hover:border-primary/25"
      }`}
      title={tooltip}
    >
      {/* Glow de fundo */}
      <div className="absolute inset-0 rounded-2xl bg-primary/[0.02] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-tight">
          {label}
        </span>
        <div className={`p-2 rounded-xl ${alert ? "bg-destructive/10" : "bg-primary/10"}`}>
          <Icon className={`w-3.5 h-3.5 ${alert ? "text-destructive" : color}`} />
        </div>
      </div>

      <div>
        <div className={`text-2xl font-black tracking-tight ${alert && Number(value.replace(/\D/g, "")) > 0 ? "text-destructive" : "text-foreground"}`}>
          {value}
        </div>
        {sub && (
          <p className="text-[10px] text-muted-foreground mt-1 font-medium">{sub}</p>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Skeleton do card
// ─────────────────────────────────────────────
function MetricCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/60 p-5 bg-card">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-8 rounded-xl" />
      </div>
      <div>
        <Skeleton className="h-7 w-32 mb-1.5" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Tooltip customizado PT-BR para gráficos
// ─────────────────────────────────────────────
function CustomTooltip({ active, payload, label, currency }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border/60 bg-card/95 backdrop-blur-sm p-3 shadow-xl text-xs">
      <p className="font-bold text-muted-foreground mb-1.5">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
          <span className="text-foreground font-semibold">
            {currency ? formatBRL(entry.value) : formatNumber(entry.value)}
          </span>
          <span className="text-muted-foreground">{entry.name}</span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Estado vazio de gráfico
// ─────────────────────────────────────────────
function ChartEmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[200px] gap-3 text-center text-muted-foreground">
      <BarChart2 className="w-8 h-8 opacity-20" />
      <p className="text-xs font-medium max-w-[180px] leading-relaxed">{message}</p>
    </div>
  );
}

// ─────────────────────────────────────────────
// Componente Principal
// ─────────────────────────────────────────────
export default function DashboardPage() {
  const { accounts, selectedAccountId, selectedAccount, isSyncing, triggerSync } = useMeli();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [period, setPeriod] = useState("30");
  const [specificDate, setSpecificDate] = useState(todayInputValue);

  // Banner OAuth2
  const [connectionMessage, setConnectionMessage] = useState<{
    type: "success" | "error";
    text: string;
    details?: string;
  } | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const connect = params.get("connect");
      const msg = params.get("msg");
      const details = params.get("details");

      if (connect === "success") {
        setConnectionMessage({ type: "success", text: "Conta oficial vinculada com sucesso!" });
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (connect === "error") {
        const msgs: Record<string, string> = {
          permissao_negada: "Você recusou a autorização de acesso ao Datex no Mercado Livre.",
          codigo_ausente: "Código de autorização inválido ou ausente.",
          credenciais_ausentes: "Credenciais OAuth2 ausentes ou incorretas no servidor.",
          troca_token_falhou: "A troca de código por token falhou na API do Mercado Livre.",
          erro_interno: "Erro interno no servidor ao salvar tokens.",
        };
        setConnectionMessage({
          type: "error",
          text: msgs[msg || ""] || "Erro ao vincular conta.",
          details: details ? decodeURIComponent(details) : undefined,
        });
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  // Carrega métricas
  const fetchMetrics = useCallback(async (accountId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        accountId,
        period,
      });

      if (period === "custom") {
        params.set("date", specificDate);
      }

      const res = await fetch(`/api/dashboard/metrics?${params.toString()}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Erro ao carregar métricas.");
      }
      const json = await res.json();
      if (json.success) {
        setData(json);
        setLastRefreshed(new Date());
      }
    } catch (err: any) {
      setError(err.message || "Erro desconhecido.");
    } finally {
      setIsLoading(false);
    }
  }, [period, specificDate]);

  // Re-busca sempre que a conta selecionada mudar
  useEffect(() => {
    if (accounts.length > 0) {
      fetchMetrics(selectedAccountId);
    }
  }, [selectedAccountId, accounts.length, fetchMetrics]);

  // ─── Se não há contas, exibe estado vazio ───────────────────────
  if (accounts.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-foreground/90">
            Painel Operacional
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground font-medium">
            Visão unificada das suas operações do Mercado Livre.
          </p>
        </div>
        <EmptyState
          title="Nenhuma conta conectada"
          description="Vincule sua primeira conta do Mercado Livre para começar a ver métricas reais de vendas, anúncios, reputação e muito mais."
          icon={LayoutDashboard}
          pageName="Dashboard"
        />
      </div>
    );
  }

  const cards = data?.cards;
  const charts = data?.charts;

  const accountLabel =
    selectedAccountId === "all"
      ? `${accounts.length} conta(s) consolidada(s)`
      : selectedAccount?.nickname ?? "Conta selecionada";
  const rangeLabel =
    period === "custom"
      ? new Date(`${specificDate}T00:00:00`).toLocaleDateString("pt-BR")
      : `últimos ${period} dias`;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      {/* ─── Banner de status OAuth2 ─── */}
      {connectionMessage && (
        <div
          className={`p-4 rounded-2xl border backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-300 flex items-start justify-between gap-4 ${
            connectionMessage.type === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          }`}
        >
          <div className="flex gap-3">
            <span className="text-lg shrink-0">{connectionMessage.type === "success" ? "🎉" : "⚠️"}</span>
            <div>
              <h4 className="text-xs font-extrabold tracking-wide uppercase">
                {connectionMessage.type === "success" ? "Conexão Concluída" : "Falha na Conexão"}
              </h4>
              <p className="text-xs font-semibold mt-1 text-foreground/95">{connectionMessage.text}</p>
              {connectionMessage.details && (
                <p className="text-[10px] font-mono mt-1.5 opacity-70 bg-black/20 p-1.5 rounded-lg text-muted-foreground">
                  {connectionMessage.details}
                </p>
              )}
            </div>
          </div>
          <button onClick={() => setConnectionMessage(null)} className="text-xs font-bold hover:opacity-70 px-2.5 py-1 rounded-lg cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-5">
        <div className="space-y-1">
          <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-foreground/90">
            Painel Operacional
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground font-medium">
            {accountLabel}
            {lastRefreshed && (
              <span className="ml-2 text-[10px] text-muted-foreground/60">
                · Atualizado às {lastRefreshed.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
          <div className="flex items-center rounded-xl border border-border/60 bg-card p-1">
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setPeriod(option.value)}
                className={`h-8 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  period === option.value
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {period === "custom" && (
            <label className="flex items-center gap-2 h-10 px-3 rounded-xl border border-border/60 bg-card text-xs font-bold text-muted-foreground">
              <CalendarDays className="w-3.5 h-3.5" />
              <input
                type="date"
                value={specificDate}
                onChange={(event) => setSpecificDate(event.target.value)}
                className="bg-transparent text-foreground outline-none [color-scheme:dark]"
              />
            </label>
          )}

          <Button
            onClick={async () => { await triggerSync(); await fetchMetrics(selectedAccountId); }}
            disabled={isLoading || isSyncing}
            size="sm"
            className="rounded-xl text-xs font-bold gap-2 bg-blue-600 hover:bg-blue-700 text-white h-10 px-4"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "Sincronizando..." : "Sincronizar ML"}
          </Button>
        </div>
      </div>

      {/* ─── Erro ─── */}
      {error && (
        <div className="p-4 rounded-2xl border border-destructive/30 bg-destructive/5 text-destructive text-xs font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
          <button
            onClick={() => fetchMetrics(selectedAccountId)}
            className="ml-auto underline cursor-pointer"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          SEÇÃO 1: CARDS PRINCIPAIS — Vendas & Faturamento
      ═══════════════════════════════════════════════════════ */}
      <section className="space-y-3">
        <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
          <DollarSign className="w-3.5 h-3.5" />
          Vendas & Faturamento
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <MetricCardSkeleton key={i} />)
          ) : (
            <>
              <MetricCard
                icon={ShoppingCart}
                label="Vendas"
                value={formatNumber(cards?.salesToday ?? 0)}
                sub={rangeLabel}
                color="text-primary"
              />
              <MetricCard
                icon={DollarSign}
                label="Faturamento"
                value={formatBRL(cards?.revenueToday ?? 0)}
                sub={rangeLabel}
                color="text-emerald-500"
              />
              <MetricCard
                icon={TrendingUp}
                label="Ticket Médio"
                value={formatBRL(cards?.avgTicket ?? 0)}
                sub={`média ${rangeLabel}`}
                color="text-violet-500"
              />
              <MetricCard
                icon={Receipt}
                label="Pedidos no Período"
                value={formatNumber(cards?.ordersTotal ?? 0)}
                sub="total de pedidos"
                color="text-sky-500"
              />
            </>
          )}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SEÇÃO 2: CARDS — Anúncios & Catálogo
      ═══════════════════════════════════════════════════════ */}
      <section className="space-y-3">
        <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
          <Tag className="w-3.5 h-3.5" />
          Catálogo & Anúncios
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
          {isLoading ? (
            Array.from({ length: 2 }).map((_, i) => <MetricCardSkeleton key={i} />)
          ) : (
            <>
              <MetricCard
                icon={Tag}
                label="Anúncios Ativos"
                value={formatNumber(cards?.activeListings ?? 0)}
                sub="publicados no momento"
                color="text-emerald-500"
              />
              <MetricCard
                icon={PauseCircle}
                label="Anúncios Pausados"
                value={formatNumber(cards?.pausedListings ?? 0)}
                sub="aguardando reativação"
                alert={(cards?.pausedListings ?? 0) > 0}
                color="text-amber-500"
              />
            </>
          )}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SEÇÃO 3: CARDS — Atendimento & Operações
      ═══════════════════════════════════════════════════════ */}
      <section className="space-y-3">
        <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5" />
          Atendimento & Operações
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <MetricCardSkeleton key={i} />)
          ) : (
            <>
              <MetricCard
                icon={MessageCircleQuestion}
                label="Perguntas Pendentes"
                value={formatNumber(cards?.pendingQuestions ?? 0)}
                sub="sem resposta"
                alert={(cards?.pendingQuestions ?? 0) > 0}
                color="text-amber-500"
              />
              <MetricCard
                icon={AlertTriangle}
                label="Reclamações"
                value={formatNumber(cards?.activeClaims ?? 0)}
                sub="abertas"
                alert={(cards?.activeClaims ?? 0) > 0}
                color="text-destructive"
              />
              <MetricCard
                icon={XCircle}
                label="Cancelamentos"
                value={formatNumber(cards?.cancelledOrders ?? 0)}
                sub="pedidos cancelados"
                alert={(cards?.cancelledOrders ?? 0) > 0}
                color="text-destructive"
              />
              <MetricCard
                icon={Truck}
                label="Envios com Atraso"
                value={formatNumber(cards?.lateShipments ?? 0)}
                sub="+2 dias sem postagem"
                alert={(cards?.lateShipments ?? 0) > 0}
                color="text-orange-500"
              />
              {/* Card de Reputação */}
              <div
                className={`relative group flex flex-col gap-3 rounded-2xl border p-5 bg-card transition-all hover:shadow-md hover:-translate-y-0.5 ${
                  cards?.reputation
                    ? (REPUTATION_MAP[cards.reputation.levelId ?? ""] || {}).bg?.includes("emerald")
                      ? "border-emerald-500/20"
                      : "border-border/60"
                    : "border-border/60"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    Saúde da Reputação
                  </span>
                  <div className="p-2 rounded-xl bg-primary/10">
                    <Star className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                </div>
                {isLoading ? (
                  <Skeleton className="h-7 w-32" />
                ) : cards?.reputation ? (
                  <div>
                    <div
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                        REPUTATION_MAP[cards.reputation.levelId ?? ""]?.bg || "bg-muted text-muted-foreground border-border"
                      }`}
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{
                          background:
                            REPUTATION_MAP[cards.reputation.levelId ?? ""]?.color || "#888",
                        }}
                      />
                      {REPUTATION_MAP[cards.reputation.levelId ?? ""]?.label ||
                        cards.reputation.levelId ||
                        "Desconhecido"}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2 font-medium">
                      {formatNumber(cards.reputation.salesCompleted)} vendas concluídas
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-bold text-muted-foreground">—</p>
                    <p className="text-[10px] text-muted-foreground mt-1 font-medium">
                      Sincronize para ver a reputação
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SEÇÃO 4: GRÁFICOS — Faturamento & Vendas por Dia
      ═══════════════════════════════════════════════════════ */}
      <section className="space-y-3">
        <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
          <TrendingUp className="w-3.5 h-3.5" />
          Evolução Temporal — {rangeLabel}
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Faturamento por dia */}
          <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
            <CardHeader className="pb-3 border-b border-border/30">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-primary" />
                Faturamento Diário
              </CardTitle>
              <CardDescription className="text-xs">
                Volume de vendas aprovadas por dia (BRL)
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 px-2">
              {isLoading ? (
                <Skeleton className="h-[220px] w-full" />
              ) : !charts?.revenueByDay?.some((d) => d.revenue > 0) ? (
                <ChartEmptyState message={`Nenhuma venda registrada em ${rangeLabel}. Sincronize suas contas para ver dados.`} />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart
                    data={charts.revenueByDay}
                    margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatShortDate}
                      tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                      interval={4}
                    />
                    <YAxis
                      tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                      tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                      width={48}
                    />
                    <Tooltip content={<CustomTooltip currency />} />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      name="Faturamento"
                      stroke="#6366f1"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5, fill: "#6366f1", stroke: "hsl(var(--background))", strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Vendas por dia */}
          <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
            <CardHeader className="pb-3 border-b border-border/30">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-emerald-500" />
                Vendas por Dia
              </CardTitle>
              <CardDescription className="text-xs">
                Quantidade de pedidos aprovados por dia
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 px-2">
              {isLoading ? (
                <Skeleton className="h-[220px] w-full" />
              ) : !charts?.salesByDay?.some((d) => d.count > 0) ? (
                <ChartEmptyState message={`Nenhuma venda registrada em ${rangeLabel}. Sincronize suas contas para ver dados.`} />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={charts.salesByDay}
                    margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatShortDate}
                      tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                      interval={4}
                    />
                    <YAxis
                      tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                      width={30}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar
                      dataKey="count"
                      name="Vendas"
                      fill="#10b981"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={24}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SEÇÃO 5: GRÁFICOS — Distribuições
      ═══════════════════════════════════════════════════════ */}
      <section className="space-y-3">
        <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
          <BarChart2 className="w-3.5 h-3.5" />
          Distribuições & Composição
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-6">
          {/* Status dos Anúncios */}
          <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
            <CardHeader className="pb-3 border-b border-border/30">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Tag className="w-4 h-4 text-primary" />
                Status dos Anúncios
              </CardTitle>
              <CardDescription className="text-xs">
                Distribuição por status atual
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              {isLoading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : !charts?.listingsByStatus?.length ? (
                <ChartEmptyState message="Nenhum anúncio sincronizado ainda." />
              ) : (
                <div className="flex flex-col gap-4">
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie
                        data={charts.listingsByStatus}
                        dataKey="count"
                        nameKey="status"
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={3}
                      >
                        {charts.listingsByStatus.map((entry, index) => (
                          <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: any, name: any) => [
                          formatNumber(Number(value)),
                          LISTING_STATUS_LABELS[String(name)] || String(name),
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {charts.listingsByStatus.map((entry, index) => (
                      <span
                        key={index}
                        className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground"
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ background: CHART_COLORS[index % CHART_COLORS.length] }}
                        />
                        {LISTING_STATUS_LABELS[entry.status] || entry.status}:{" "}
                        <span className="text-foreground font-bold">{formatNumber(entry.count)}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Performance por Conta (apenas no modo "todas as contas") */}
          {selectedAccountId === "all" ? (
            <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
              <CardHeader className="pb-3 border-b border-border/30">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <ChevronRight className="w-4 h-4 text-sky-500" />
                  Performance por Conta
                </CardTitle>
                <CardDescription className="text-xs">
                  Faturamento total por loja conectada
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                {isLoading ? (
                  <Skeleton className="h-[200px] w-full" />
                ) : !charts?.performanceByAccount?.length ? (
                  <ChartEmptyState message="Nenhuma conta com dados disponíveis." />
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart
                      data={charts.performanceByAccount}
                      margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                      layout="vertical"
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} horizontal={false} />
                      <XAxis
                        type="number"
                        tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                        tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="nickname"
                        tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                        tickLine={false}
                        axisLine={false}
                        width={80}
                      />
                      <Tooltip content={<CustomTooltip currency />} />
                      <Bar
                        dataKey="revenue"
                        name="Faturamento"
                        fill="#6366f1"
                        radius={[0, 4, 4, 0]}
                        maxBarSize={20}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          ) : (
            /* Card de dica de reputação detalhada */
            cards?.reputation ? (
              <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
                <CardHeader className="pb-3 border-b border-border/30">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Star className="w-4 h-4 text-amber-400" />
                    Detalhes da Reputação
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Indicadores de performance do vendedor
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  {isLoading ? (
                    <Skeleton className="h-[200px]" />
                  ) : (
                    <div className="space-y-3">
                      {[
                        {
                          label: "Taxa de Reclamações",
                          value: cards.reputation.claimsRate,
                          threshold: 0.03,
                        },
                        {
                          label: "Cancelamentos",
                          value: cards.reputation.cancellationsRate,
                          threshold: 0.03,
                        },
                        {
                          label: "Atrasos no Envio",
                          value: cards.reputation.delayedHandlingTimeRate,
                          threshold: 0.05,
                        },
                      ].map((item) => (
                        <div key={item.label} className="space-y-1.5">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground font-medium">{item.label}</span>
                            <span
                              className={`font-bold ${
                                item.value > item.threshold ? "text-destructive" : "text-emerald-500"
                              }`}
                            >
                              {formatPercent(item.value)}
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                item.value > item.threshold ? "bg-destructive" : "bg-emerald-500"
                              }`}
                              style={{ width: `${Math.min(item.value * 100 * 10, 100)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground pt-1 border-t border-border/40">
                        <Info className="w-3 h-3 shrink-0" />
                        Taxas abaixo de 3% são consideradas excelentes pelo Mercado Livre
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : null
          )}
        </div>
      </section>
    </div>
  );
}
