"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Eye,
  Layers3,
  Megaphone,
  PackageSearch,
  RefreshCw,
  Search,
  Sparkles,
  Target,
  Ticket,
} from "lucide-react";
import { useMeli } from "@/context/meli-context";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type ProductId = "PADS" | "BADS" | "DISPLAY";

type PublicidadeOverview = {
  success: boolean;
  dateFrom: string;
  dateTo: string;
  accounts: Array<{
    id: string;
    displayName: string;
    siteId: string | null;
    products: Record<
      ProductId,
      {
        advertisers: number;
        campaigns: number;
        ads: number;
        available: boolean;
        error?: string;
      }
    >;
  }>;
  productAds: {
    advertisers: Array<any>;
    campaigns: Array<any>;
    ads: Array<any>;
    selectedCampaign: any | null;
    selectedCampaignDetail: any | null;
  };
  brandAds: {
    advertisers: Array<any>;
    campaigns: Array<any>;
    selectedCampaign: any | null;
    selectedCampaignDetail: {
      campaign: any;
      items: Array<any>;
      keywords: Array<any>;
      keywordMetrics: any;
    };
  };
  display: {
    advertisers: Array<any>;
    campaigns: Array<any>;
    selectedCampaign: any | null;
    selectedCampaignDetail: {
      metrics: any;
      lineItems: Array<any>;
      creativesByLineItem: Record<string, Array<any>>;
      lineItemMetrics: Array<any>;
    };
  };
  bonifications: Array<{
    accountId: string;
    accountLabel: string;
    bonifications: Array<any>;
  }>;
  summary: {
    productAds: {
      advertisers: number;
      campaigns: number;
      ads: number;
      recommendedAds: number;
    };
    brandAds: {
      advertisers: number;
      campaigns: number;
      items: number;
      keywords: number;
      keywordMetricSets: number;
    };
    display: {
      advertisers: number;
      campaigns: number;
      lineItems: number;
      creatives: number;
      lineItemMetricSets: number;
    };
    bonifications: number;
    activeBonifications: number;
  };
  errors: Array<{ accountId: string; accountName: string; product: string; message: string }>;
};

function money(value?: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(typeof value === "number" && Number.isFinite(value) ? value : 0);
}

function integer(value?: number) {
  return new Intl.NumberFormat("pt-BR").format(typeof value === "number" && Number.isFinite(value) ? value : 0);
}

function percent(value?: number) {
  const raw = typeof value === "number" && Number.isFinite(value) ? value : 0;
  const normalized = raw <= 1 ? raw * 100 : raw;
  return `${normalized.toFixed(2).replace(".", ",")}%`;
}

function dateLabel(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function pickMetric(metrics: any, key: string) {
  if (!metrics) return 0;
  if (typeof metrics[key] === "number") return metrics[key];

  const dashboard = metrics.dashboard?.[key];
  if (Array.isArray(dashboard) && dashboard.length > 0) {
    const last = dashboard[dashboard.length - 1];
    if (typeof last?.y === "number") return last.y;
  }

  if (Array.isArray(metrics?.metrics) && metrics.metrics.length > 0) {
    const last = metrics.metrics[metrics.metrics.length - 1];
    if (typeof last?.[key] === "number") return last[key];
  }

  return 0;
}

function campaignMetrics(campaign: any) {
  return campaign?.metrics_summary || campaign?.metrics || {};
}

function statTone(available: boolean, error?: string) {
  if (error) return "border-amber-500/20 bg-amber-500/10 text-amber-600";
  if (available) return "border-emerald-500/20 bg-emerald-500/10 text-emerald-600";
  return "border-border bg-muted text-muted-foreground";
}

function SectionCard({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden border-border/60">
      <CardHeader className="border-b border-border/50 bg-muted/25">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription className="mt-1 text-xs">{description}</CardDescription>
          </div>
          {action}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4">{children}</CardContent>
    </Card>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ElementType;
}) {
  return (
    <Card className="border-border/60 bg-card/70">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-black text-foreground">{value}</p>
            <p className="mt-1 text-[10px] font-medium text-muted-foreground">{sub}</p>
          </div>
          <div className="rounded-xl bg-primary/10 p-2 text-primary">
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PublicidadePage() {
  const { accounts, selectedAccountId, selectedAccount, isSyncing, triggerSync } = useMeli();
  const [data, setData] = useState<PublicidadeOverview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [recommendedOnly, setRecommendedOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [productCampaignId, setProductCampaignId] = useState("");
  const [brandCampaignId, setBrandCampaignId] = useState("");
  const [displayCampaignId, setDisplayCampaignId] = useState("");

  const fetchPublicidade = useCallback(async () => {
    if (accounts.length === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        accountId: selectedAccountId,
        dateFrom,
        dateTo,
      });

      if (recommendedOnly) params.set("recommendedOnly", "true");
      if (productCampaignId) params.set("productCampaignId", productCampaignId);
      if (brandCampaignId) params.set("brandCampaignId", brandCampaignId);
      if (displayCampaignId) params.set("displayCampaignId", displayCampaignId);

      const response = await fetch(`/api/publicidade/overview?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Nao foi possivel carregar publicidade.");
      }

      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [
    accounts.length,
    brandCampaignId,
    dateFrom,
    dateTo,
    displayCampaignId,
    productCampaignId,
    recommendedOnly,
    selectedAccountId,
  ]);

  useEffect(() => {
    fetchPublicidade();
  }, [fetchPublicidade]);

  useEffect(() => {
    if (!data) return;

    if (!productCampaignId && data.productAds.selectedCampaign) {
      setProductCampaignId(String(data.productAds.selectedCampaign.id));
    }
    if (!brandCampaignId && data.brandAds.selectedCampaign) {
      setBrandCampaignId(String(data.brandAds.selectedCampaign.campaign_id));
    }
    if (!displayCampaignId && data.display.selectedCampaign) {
      setDisplayCampaignId(String(data.display.selectedCampaign.id));
    }
  }, [brandCampaignId, data, displayCampaignId, productCampaignId]);

  const filteredProductCampaigns = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data?.productAds.campaigns ?? []).filter((campaign) =>
      !term ||
      [campaign.name, campaign.accountLabel, campaign.advertiserName, String(campaign.id)]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [data?.productAds.campaigns, search]);

  const filteredProductAds = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data?.productAds.ads ?? []).filter((ad) =>
      !term ||
      [ad.title, ad.accountLabel, ad.advertiserName, ad.campaign_name, ad.campaign_name, String(ad.item_id || ad.id)]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [data?.productAds.ads, search]);

  const filteredBrandCampaigns = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data?.brandAds.campaigns ?? []).filter((campaign) =>
      !term ||
      [campaign.name, campaign.accountLabel, campaign.advertiserName, String(campaign.campaign_id)]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [data?.brandAds.campaigns, search]);

  const filteredDisplayCampaigns = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data?.display.campaigns ?? []).filter((campaign) =>
      !term ||
      [campaign.name, campaign.accountLabel, campaign.advertiserName, String(campaign.id)]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [data?.display.campaigns, search]);

  if (accounts.length === 0) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-black tracking-tight">Publicidade</h1>
          <p className="text-sm text-muted-foreground">
            Conecte uma conta Mercado Livre para liberar as consultas oficiais de Mercado Ads.
          </p>
        </div>
        <EmptyState
          title="Nenhuma conta conectada"
          description="A área de publicidade depende de uma conta Mercado Livre autenticada."
          icon={Megaphone}
          pageName="Publicidade"
        />
      </div>
    );
  }

  const selectedProductCampaign = data?.productAds.selectedCampaign ?? null;
  const selectedBrandCampaign = data?.brandAds.selectedCampaign ?? null;
  const selectedDisplayCampaign = data?.display.selectedCampaign ?? null;

  const productMetrics = selectedProductCampaign?.metrics_summary || selectedProductCampaign?.metrics || {};
  const brandCampaignMetrics = data?.brandAds.selectedCampaignDetail?.keywordMetrics || data?.brandAds.selectedCampaignDetail?.campaign?.metrics || {};
  const displayCampaignMetrics = data?.display.selectedCampaignDetail?.metrics || {};

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col gap-4 border-b border-border/40 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Mercado Ads oficial
          </div>
          <h1 className="text-3xl font-black tracking-tight">Publicidade</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Painel unificado para Product Ads, Brand Ads, Display Ads e bonificações. As seções
            exibem apenas o que a API oficial entrega.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 rounded-xl border border-border/60 bg-card px-3 py-2 text-xs font-semibold">
            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="bg-transparent outline-none"
            />
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-border/60 bg-card px-3 py-2 text-xs font-semibold">
            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="bg-transparent outline-none"
            />
          </label>
          <Button onClick={fetchPublicidade} disabled={isLoading} className="h-9 rounded-xl text-xs">
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard
          label="Product Ads"
          value={integer(data?.summary.productAds.campaigns)}
          sub={`${integer(data?.summary.productAds.ads)} anúncios monitorados`}
          icon={Megaphone}
        />
        <SummaryCard
          label="Brand Ads"
          value={integer(data?.summary.brandAds.campaigns)}
          sub={`${integer(data?.summary.brandAds.items)} itens vinculados`}
          icon={Target}
        />
        <SummaryCard
          label="Display Ads"
          value={integer(data?.summary.display.campaigns)}
          sub={`${integer(data?.summary.display.lineItems)} line items`}
          icon={Eye}
        />
        <SummaryCard
          label="Bonificações"
          value={integer(data?.summary.bonifications)}
          sub={`${integer(data?.summary.activeBonifications)} ativas`}
          icon={Ticket}
        />
        <SummaryCard
          label="Anúncios recomendados"
          value={integer(data?.summary.productAds.recommendedAds)}
          sub="Sinal de oportunidade em Product Ads"
          icon={CheckCircle2}
        />
      </div>

      {error ? (
        <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <SectionCard
        title="Cobertura por conta"
        description="Status da publicidade por conta conectada e por produto."
        action={
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 rounded-xl border border-border/60 bg-background px-3 py-2 text-xs">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar campanha, anúncio ou conta"
                className="w-[260px] bg-transparent outline-none placeholder:text-muted-foreground/70"
              />
            </label>
            <button
              onClick={() => setRecommendedOnly((value) => !value)}
              className={`h-9 rounded-xl border px-3 text-xs font-semibold transition-colors ${
                recommendedOnly
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border/60 bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              Recomendados
            </button>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-border/60 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <tr>
                <th className="px-3 py-3">Conta</th>
                <th className="px-3 py-3">Product Ads</th>
                <th className="px-3 py-3">Brand Ads</th>
                <th className="px-3 py-3">Display Ads</th>
                <th className="px-3 py-3">Bonificações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {data?.accounts.map((account) => (
                <tr key={account.id}>
                  <td className="px-3 py-4">
                    <div className="space-y-1">
                      <p className="font-semibold text-foreground">{account.displayName}</p>
                      <p className="text-xs text-muted-foreground">{account.siteId || "site não informado"}</p>
                    </div>
                  </td>
                  {(["PADS", "BADS", "DISPLAY"] as const).map((product) => {
                    const current = account.products[product];
                    return (
                      <td key={product} className="px-3 py-4">
                        <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${statTone(current.available, current.error)}`}>
                          {current.error ? (
                            <AlertTriangle className="h-3.5 w-3.5" />
                          ) : current.available ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                          <span>
                            {current.available ? "Disponível" : current.error ? "Erro" : "Sem retorno"}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {integer(current.advertisers)} anunciantes, {integer(current.campaigns)} campanhas
                        </p>
                      </td>
                    );
                  })}
                  <td className="px-3 py-4 text-sm text-muted-foreground">
                    {integer(data?.bonifications.find((entry) => entry.accountId === account.id)?.bonifications.length)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        title="Product Ads"
        description="Campanhas, anúncios e métricas do produto oficial Product Ads."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={productCampaignId}
              onChange={(event) => setProductCampaignId(event.target.value)}
              className="h-9 rounded-xl border border-border/60 bg-background px-3 text-xs"
            >
              {filteredProductCampaigns.length === 0 ? (
                <option value="">Sem campanhas</option>
              ) : null}
              {filteredProductCampaigns.map((campaign) => (
                <option key={`${campaign.accountId}-${campaign.advertiserId}-${campaign.id}`} value={String(campaign.id)}>
                  {campaign.name}
                </option>
              ))}
            </select>
          </div>
        }
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Investimento</p>
            <p className="mt-2 text-xl font-black">{money(pickMetric(productMetrics, "cost"))}</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Receita</p>
            <p className="mt-2 text-xl font-black">{money(pickMetric(productMetrics, "total_amount"))}</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">ROAS</p>
            <p className="mt-2 text-xl font-black">{pickMetric(productMetrics, "roas").toFixed(2)}x</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">CTR</p>
            <p className="mt-2 text-xl font-black">{percent(pickMetric(productMetrics, "ctr"))}</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Cliques</p>
            <p className="mt-2 text-xl font-black">{integer(pickMetric(productMetrics, "clicks"))}</p>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-3">
            <div className="overflow-x-auto rounded-2xl border border-border/60">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="bg-muted/30 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  <tr>
                    <th className="px-3 py-3">Campanha</th>
                    <th className="px-3 py-3">Conta</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Budget</th>
                    <th className="px-3 py-3">Cost</th>
                    <th className="px-3 py-3">ROAS</th>
                    <th className="px-3 py-3">CTR</th>
                    <th className="px-3 py-3">Cliques</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredProductCampaigns.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-10 text-center text-xs text-muted-foreground">
                        Nenhuma campanha Product Ads retornada para os filtros atuais.
                      </td>
                    </tr>
                  ) : (
                    filteredProductCampaigns.map((campaign) => (
                      <tr key={`${campaign.accountId}-${campaign.advertiserId}-${campaign.id}`} className="hover:bg-muted/20">
                        <td className="px-3 py-4">
                          <div className="space-y-1">
                            <p className="font-semibold text-foreground">{campaign.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {campaign.advertiserName} · {campaign.advertiserSiteId}
                            </p>
                          </div>
                        </td>
                        <td className="px-3 py-4 text-xs text-muted-foreground">{campaign.accountLabel}</td>
                        <td className="px-3 py-4">
                          <span className="rounded-full border border-border px-2 py-1 text-xs font-semibold text-muted-foreground">
                            {campaign.status}
                          </span>
                        </td>
                        <td className="px-3 py-4 text-xs font-semibold">{money(campaign.budget, campaign.currency_id || "BRL")}</td>
                        <td className="px-3 py-4 text-xs font-semibold">{money(campaignMetrics(campaign).cost, campaign.currency_id || "BRL")}</td>
                        <td className="px-3 py-4 text-xs font-semibold">{pickMetric(campaignMetrics(campaign), "roas").toFixed(2)}x</td>
                        <td className="px-3 py-4 text-xs font-semibold">{percent(pickMetric(campaignMetrics(campaign), "ctr"))}</td>
                        <td className="px-3 py-4 text-xs font-semibold">{integer(pickMetric(campaignMetrics(campaign), "clicks"))}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-border/60">
              <table className="w-full min-w-[1080px] text-left text-sm">
                <thead className="bg-muted/30 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  <tr>
                    <th className="px-3 py-3">Anúncio</th>
                    <th className="px-3 py-3">Campanha</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Preço</th>
                    <th className="px-3 py-3">Recomendado</th>
                    <th className="px-3 py-3">Cliques</th>
                    <th className="px-3 py-3">Receita</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredProductAds.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-10 text-center text-xs text-muted-foreground">
                        Nenhum anúncio Product Ads retornado para os filtros atuais.
                      </td>
                    </tr>
                  ) : (
                    filteredProductAds.slice(0, 60).map((ad) => (
                      <tr key={`${ad.accountId}-${ad.advertiserId}-${ad.id}`} className="hover:bg-muted/20">
                        <td className="px-3 py-4">
                          <div className="flex items-center gap-3">
                            {ad.thumbnail ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={ad.thumbnail}
                                alt=""
                                className="h-11 w-11 rounded-xl border border-border/60 object-cover"
                              />
                            ) : (
                              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-border/60 bg-muted/30">
                                <PackageSearch className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="line-clamp-2 font-semibold text-foreground">{ad.title || "Anúncio sem título"}</p>
                              <p className="mt-1 text-xs text-muted-foreground">{String(ad.item_id || ad.id)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-4 text-xs text-muted-foreground">{ad.campaign_name || "-"}</td>
                        <td className="px-3 py-4">
                          <span className="rounded-full border border-border px-2 py-1 text-xs font-semibold text-muted-foreground">
                            {ad.status || "-"}
                          </span>
                        </td>
                        <td className="px-3 py-4 text-xs font-semibold">{money(ad.price, ad.currency_id || "BRL")}</td>
                        <td className="px-3 py-4 text-xs font-semibold">{ad.recommended ? "Sim" : "Não"}</td>
                        <td className="px-3 py-4 text-xs font-semibold">{integer(pickMetric(ad.metrics_summary || ad.metrics, "clicks"))}</td>
                        <td className="px-3 py-4 text-xs font-semibold">{money(pickMetric(ad.metrics_summary || ad.metrics, "total_amount"), ad.currency_id || "BRL")}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <BarChart3 className="h-4 w-4 text-primary" />
                Seleção atual
              </div>
              <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                <p>Campanha: <span className="font-semibold text-foreground">{selectedProductCampaign?.name || "-"}</span></p>
                <p>Conta: <span className="font-semibold text-foreground">{selectedProductCampaign?.accountLabel || selectedAccount?.displayName || "-"}</span></p>
                <p>Status: <span className="font-semibold text-foreground">{selectedProductCampaign?.status || "-"}</span></p>
                <p>Budget: <span className="font-semibold text-foreground">{money(selectedProductCampaign?.budget, selectedProductCampaign?.currency_id || "BRL")}</span></p>
              </div>
            </div>

            {data?.productAds.selectedCampaignDetail ? (
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                <p className="text-sm font-semibold text-foreground">Detalhe bruto da campanha selecionada</p>
                <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between gap-3">
                    <span>Endpoint</span>
                    <span>/product_ads/campaigns/{String(selectedProductCampaign?.id || "-")}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Itens/Chaves</span>
                    <span>{String(data.productAds.selectedCampaignDetail?.results?.length || data.productAds.selectedCampaignDetail?.items?.length || 0)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Última atualização</span>
                    <span>{dateLabel(selectedProductCampaign?.last_updated || selectedProductCampaign?.date_created)}</span>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Brand Ads"
        description="Campanhas, itens e keywords do produto de Brand Ads."
        action={
          <select
            value={brandCampaignId}
            onChange={(event) => setBrandCampaignId(event.target.value)}
            className="h-9 rounded-xl border border-border/60 bg-background px-3 text-xs"
          >
            {filteredBrandCampaigns.length === 0 ? <option value="">Sem campanhas</option> : null}
            {filteredBrandCampaigns.map((campaign) => (
              <option key={`${campaign.accountId}-${campaign.advertiserId}-${campaign.campaign_id}`} value={String(campaign.campaign_id)}>
                {campaign.name}
              </option>
            ))}
          </select>
        }
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">CTR</p>
            <p className="mt-2 text-xl font-black">{percent(pickMetric(brandCampaignMetrics, "ctr"))}</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Cliques</p>
            <p className="mt-2 text-xl font-black">{integer(pickMetric(brandCampaignMetrics, "clicks"))}</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Investimento</p>
            <p className="mt-2 text-xl font-black">{money(pickMetric(brandCampaignMetrics, "consumed_budget"))}</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Conversões</p>
            <p className="mt-2 text-xl font-black">{integer(pickMetric(brandCampaignMetrics, "attribution_order_conversions"))}</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Pedidos</p>
            <p className="mt-2 text-xl font-black">{money(pickMetric(brandCampaignMetrics, "attribution_order_amount"))}</p>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="overflow-x-auto rounded-2xl border border-border/60">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="bg-muted/30 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <tr>
                  <th className="px-3 py-3">Campanha</th>
                  <th className="px-3 py-3">Conta</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Tipo</th>
                  <th className="px-3 py-3">Budget</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredBrandCampaigns.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-10 text-center text-xs text-muted-foreground">
                      Nenhuma campanha Brand Ads retornada para os filtros atuais.
                    </td>
                  </tr>
                ) : (
                  filteredBrandCampaigns.map((campaign) => (
                    <tr key={`${campaign.accountId}-${campaign.advertiserId}-${campaign.campaign_id}`} className="hover:bg-muted/20">
                      <td className="px-3 py-4">
                        <div className="space-y-1">
                          <p className="font-semibold text-foreground">{campaign.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {campaign.advertiserName} · {campaign.site_id || "-"}
                          </p>
                        </div>
                      </td>
                      <td className="px-3 py-4 text-xs text-muted-foreground">{campaign.accountLabel}</td>
                      <td className="px-3 py-4 text-xs font-semibold">{campaign.status || "-"}</td>
                      <td className="px-3 py-4 text-xs font-semibold">{campaign.campaign_type || "-"}</td>
                      <td className="px-3 py-4 text-xs font-semibold">
                        {money(typeof campaign.budget === "number" ? campaign.budget : campaign.budget?.amount, typeof campaign.budget === "number" ? "BRL" : campaign.budget?.currency || "BRL")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
              <p className="text-sm font-semibold text-foreground">Seleção atual</p>
              <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                <p>Campanha: <span className="font-semibold text-foreground">{selectedBrandCampaign?.name || "-"}</span></p>
                <p>Conta: <span className="font-semibold text-foreground">{selectedBrandCampaign?.accountLabel || selectedAccount?.displayName || "-"}</span></p>
                <p>Tipo: <span className="font-semibold text-foreground">{selectedBrandCampaign?.campaign_type || "-"}</span></p>
                <p>Status: <span className="font-semibold text-foreground">{selectedBrandCampaign?.status || "-"}</span></p>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border/60">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/30 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  <tr>
                    <th className="px-3 py-3">Itens</th>
                    <th className="px-3 py-3">Keywords</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  <tr>
                    <td className="px-3 py-4 text-sm text-muted-foreground">
                      {data?.brandAds.selectedCampaignDetail?.items?.length
                        ? data.brandAds.selectedCampaignDetail.items.slice(0, 5).map((item) => item.item_id).join(", ")
                        : "Sem itens retornados"}
                    </td>
                    <td className="px-3 py-4 text-sm text-muted-foreground">
                      {data?.brandAds.selectedCampaignDetail?.keywords?.length
                        ? data.brandAds.selectedCampaignDetail.keywords.slice(0, 5).map((keyword) => keyword.term).join(", ")
                        : "Sem keywords retornadas"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <Layers3 className="h-4 w-4 text-primary" />
                Métricas detalhadas
              </div>
              <div className="mt-3 grid gap-2 text-xs">
                <div className="flex items-center justify-between">
                  <span>Impressões</span>
                  <span className="font-semibold text-foreground">{integer(pickMetric(data?.brandAds.selectedCampaignDetail?.keywordMetrics || data?.brandAds.selectedCampaignDetail?.campaign?.metrics, "prints"))}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Cliques</span>
                  <span className="font-semibold text-foreground">{integer(pickMetric(data?.brandAds.selectedCampaignDetail?.keywordMetrics || data?.brandAds.selectedCampaignDetail?.campaign?.metrics, "clicks"))}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>CTR</span>
                  <span className="font-semibold text-foreground">{percent(pickMetric(data?.brandAds.selectedCampaignDetail?.keywordMetrics || data?.brandAds.selectedCampaignDetail?.campaign?.metrics, "ctr"))}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>ACOS</span>
                  <span className="font-semibold text-foreground">{percent(pickMetric(data?.brandAds.selectedCampaignDetail?.keywordMetrics || data?.brandAds.selectedCampaignDetail?.campaign?.metrics, "acos"))}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Display Ads"
        description="Campanhas programmatic e guaranteed, line items, criativos e métricas."
        action={
          <select
            value={displayCampaignId}
            onChange={(event) => setDisplayCampaignId(event.target.value)}
            className="h-9 rounded-xl border border-border/60 bg-background px-3 text-xs"
          >
            {filteredDisplayCampaigns.length === 0 ? <option value="">Sem campanhas</option> : null}
            {filteredDisplayCampaigns.map((campaign) => (
              <option key={`${campaign.accountId}-${campaign.advertiserId}-${campaign.id}`} value={String(campaign.id)}>
                {campaign.name}
              </option>
            ))}
          </select>
        }
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Impressões</p>
            <p className="mt-2 text-xl font-black">{integer(pickMetric(displayCampaignMetrics, "prints"))}</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Cliques</p>
            <p className="mt-2 text-xl font-black">{integer(pickMetric(displayCampaignMetrics, "clicks"))}</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">CTR</p>
            <p className="mt-2 text-xl font-black">{percent(pickMetric(displayCampaignMetrics, "ctr"))}</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">CPM</p>
            <p className="mt-2 text-xl font-black">{money(pickMetric(displayCampaignMetrics, "cpm"))}</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Consumo</p>
            <p className="mt-2 text-xl font-black">{money(pickMetric(displayCampaignMetrics, "consumed_budget"))}</p>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="overflow-x-auto rounded-2xl border border-border/60">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-muted/30 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <tr>
                  <th className="px-3 py-3">Campanha</th>
                  <th className="px-3 py-3">Conta</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Tipo</th>
                  <th className="px-3 py-3">Goal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredDisplayCampaigns.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-10 text-center text-xs text-muted-foreground">
                      Nenhuma campanha Display retornada para os filtros atuais.
                    </td>
                  </tr>
                ) : (
                  filteredDisplayCampaigns.map((campaign) => (
                    <tr key={`${campaign.accountId}-${campaign.advertiserId}-${campaign.id}`} className="hover:bg-muted/20">
                      <td className="px-3 py-4">
                        <div className="space-y-1">
                          <p className="font-semibold text-foreground">{campaign.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {campaign.advertiserName} · {campaign.site_id || "-"}
                          </p>
                        </div>
                      </td>
                      <td className="px-3 py-4 text-xs text-muted-foreground">{campaign.accountLabel}</td>
                      <td className="px-3 py-4 text-xs font-semibold">{campaign.status || "-"}</td>
                      <td className="px-3 py-4 text-xs font-semibold">{campaign.type || "-"}</td>
                      <td className="px-3 py-4 text-xs font-semibold">{campaign.goal || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
              <p className="text-sm font-semibold text-foreground">Seleção atual</p>
              <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                <p>Campanha: <span className="font-semibold text-foreground">{selectedDisplayCampaign?.name || "-"}</span></p>
                <p>Conta: <span className="font-semibold text-foreground">{selectedDisplayCampaign?.accountLabel || selectedAccount?.displayName || "-"}</span></p>
                <p>Tipo: <span className="font-semibold text-foreground">{selectedDisplayCampaign?.type || "-"}</span></p>
                <p>Status: <span className="font-semibold text-foreground">{selectedDisplayCampaign?.status || "-"}</span></p>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border/60">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/30 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  <tr>
                    <th className="px-3 py-3">Line items</th>
                    <th className="px-3 py-3">Criativos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {(data?.display.selectedCampaignDetail?.lineItems?.length ?? 0) === 0 ? (
                    <tr>
                      <td colSpan={2} className="px-3 py-10 text-center text-xs text-muted-foreground">
                        Nenhum line item retornado para a campanha selecionada.
                      </td>
                    </tr>
                  ) : (
                    data?.display.selectedCampaignDetail?.lineItems?.slice(0, 3).map((lineItem) => (
                      <tr key={lineItem.line_item_id}>
                        <td className="px-3 py-4 text-xs text-muted-foreground">
                          <div className="space-y-1">
                            <p className="font-semibold text-foreground">{lineItem.name}</p>
                            <p>{lineItem.type || "-"}</p>
                            <p>{lineItem.status || "-"}</p>
                          </div>
                        </td>
                        <td className="px-3 py-4 text-xs text-muted-foreground">
                          {data.display.selectedCampaignDetail.creativesByLineItem[String(lineItem.line_item_id)]?.length
                            ? data.display.selectedCampaignDetail.creativesByLineItem[String(lineItem.line_item_id)]
                                .slice(0, 3)
                                .map((creative) => creative.name || creative.id || creative.creative_id)
                                .join(", ")
                            : "Sem criativos"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <Layers3 className="h-4 w-4 text-primary" />
                Métricas da campanha selecionada
              </div>
              <div className="mt-3 grid gap-2 text-xs">
                <div className="flex items-center justify-between">
                  <span>Impressões</span>
                  <span className="font-semibold text-foreground">{integer(pickMetric(displayCampaignMetrics, "prints"))}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Cliques</span>
                  <span className="font-semibold text-foreground">{integer(pickMetric(displayCampaignMetrics, "clicks"))}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Active views</span>
                  <span className="font-semibold text-foreground">{integer(pickMetric(displayCampaignMetrics, "active_views"))}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Reach</span>
                  <span className="font-semibold text-foreground">{integer(pickMetric(displayCampaignMetrics, "reach"))}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Bonificações"
        description="Benefícios ativos e históricos de Product Ads por conta."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <tr>
                <th className="px-3 py-3">Conta</th>
                <th className="px-3 py-3">Benefício</th>
                <th className="px-3 py-3">Nível</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Valor</th>
                <th className="px-3 py-3">Saldo</th>
                <th className="px-3 py-3">Dias restantes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {(data?.bonifications ?? []).flatMap((entry) =>
                entry.bonifications.length > 0
                  ? entry.bonifications.map((bonification) => (
                      <tr key={`${entry.accountId}-${bonification.campaign_id || bonification.creation_date || bonification.benefit_name}`}>
                        <td className="px-3 py-4 text-xs text-muted-foreground">{entry.accountLabel}</td>
                        <td className="px-3 py-4 text-sm font-semibold text-foreground">
                          {bonification.benefit_name || "-"}
                          <p className="mt-1 text-xs text-muted-foreground">{bonification.campaign_name || "Conta"}</p>
                        </td>
                        <td className="px-3 py-4 text-xs text-muted-foreground">{bonification.level || "-"}</td>
                        <td className="px-3 py-4 text-xs font-semibold">{bonification.status || "-"}</td>
                        <td className="px-3 py-4 text-xs font-semibold">{money(bonification.amount, bonification.currency_id || "BRL")}</td>
                        <td className="px-3 py-4 text-xs font-semibold">{money(bonification.balance, bonification.currency_id || "BRL")}</td>
                        <td className="px-3 py-4 text-xs font-semibold">{integer(bonification.days_remaining)}</td>
                      </tr>
                    ))
                  : [
                      <tr key={`${entry.accountId}-empty`}>
                        <td className="px-3 py-4 text-xs text-muted-foreground">{entry.accountLabel}</td>
                        <td colSpan={6} className="px-3 py-4 text-xs text-muted-foreground">
                          Nenhuma bonificação retornada pela API.
                        </td>
                      </tr>,
                    ]
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {data?.errors?.length ? (
        <SectionCard
          title="Retornos parciais"
          description="Erros isolados da API oficial por conta e produto."
        >
          <div className="space-y-2">
            {data.errors.map((item, index) => (
              <div key={`${item.accountId}-${item.product}-${index}`} className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm">
                <p className="font-semibold text-foreground">{item.accountName}</p>
                <p className="text-xs text-muted-foreground">
                  {item.product}: {item.message}
                </p>
              </div>
            ))}
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
