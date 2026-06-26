"use client";

import React, { useMemo, useState } from "react";
import {
  BarChart3,
  Calculator,
  ExternalLink,
  Layers,
  Loader2,
  Search,
  Target,
  Trophy,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMeli } from "@/context/meli-context";
import { cn } from "@/lib/utils";

type ToolKey =
  | "keyword_search"
  | "listing_analysis"
  | "competitor_analysis"
  | "rank_analysis"
  | "auto_pricer"
  | "catalog_overview";

type ResultState = Record<ToolKey, any | null>;

const toolItems: Array<{ key: ToolKey; label: string; icon: React.ElementType }> = [
  { key: "keyword_search", label: "Garimpador", icon: Search },
  { key: "listing_analysis", label: "Analise de anuncio", icon: BarChart3 },
  { key: "competitor_analysis", label: "Concorrencia", icon: Users },
  { key: "rank_analysis", label: "Ranking por MLB", icon: Trophy },
  { key: "auto_pricer", label: "Precificador", icon: Calculator },
  { key: "catalog_overview", label: "Catalogos", icon: Layers },
];

const emptyResults: ResultState = {
  keyword_search: null,
  listing_analysis: null,
  competitor_analysis: null,
  rank_analysis: null,
  auto_pricer: null,
  catalog_overview: null,
};

function formatMoney(value: unknown, currency = "BRL") {
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(number);
}

function readLines(value: string) {
  return value
    .split(/[\n,;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function MarketIntelligencePage() {
  const { accounts, selectedAccountId, selectedAccount } = useMeli();
  const [activeTool, setActiveTool] = useState<ToolKey>("keyword_search");
  const [loading, setLoading] = useState<ToolKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ResultState>(emptyResults);

  const [keyword, setKeyword] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [sort, setSort] = useState("");
  const [listingInput, setListingInput] = useState("");
  const [competitorInput, setCompetitorInput] = useState("");
  const [rankItemId, setRankItemId] = useState("");
  const [rankQuery, setRankQuery] = useState("");
  const [competitorIds, setCompetitorIds] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [discountPercent, setDiscountPercent] = useState("1");
  const [roundTo, setRoundTo] = useState("0.01");

  const accountLabel = useMemo(() => {
    if (selectedAccountId === "all") return `${accounts.length} conta(s)`;
    return selectedAccount?.displayName || selectedAccount?.nickname || "Conta selecionada";
  }, [accounts.length, selectedAccount, selectedAccountId]);

  async function runAction(action: ToolKey, payload: Record<string, unknown> = {}) {
    setLoading(action);
    setError(null);

    try {
      const response = await fetch("/api/market-intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, accountId: selectedAccountId, ...payload }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Nao foi possivel executar a consulta.");
      }

      setResults((current) => ({ ...current, [action]: data.result }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoading(null);
    }
  }

  const activeResult = results[activeTool];

  return (
    <main className="min-h-screen bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="flex flex-col gap-4 border-b border-border/60 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary">
              <Target className="h-4 w-4" />
              Inteligencia acionavel
            </div>
            <h2 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
              Mercado, concorrencia, preco e catalogo
            </h2>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Consultas reais para encontrar oportunidades, analisar anuncios, medir ranking e orientar preco sem depender de um sync completo de centenas de milhares de itens.
            </p>
          </div>
          <div className="rounded-lg border border-border/70 bg-card px-4 py-3 text-sm">
            <span className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Conta em uso
            </span>
            <span className="font-semibold text-foreground">{accountLabel}</span>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {toolItems.map((tool) => {
            const Icon = tool.icon;
            const isActive = activeTool === tool.key;
            return (
              <button
                key={tool.key}
                onClick={() => setActiveTool(tool.key)}
                className={cn(
                  "flex h-24 flex-col justify-between rounded-lg border p-4 text-left transition-all",
                  isActive
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border bg-card hover:border-primary/50 hover:bg-accent"
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-sm font-bold leading-tight">{tool.label}</span>
              </button>
            );
          })}
        </section>

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
            {error}
          </div>
        )}

        <section className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
          <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
            {activeTool === "keyword_search" && (
              <div className="space-y-4">
                <PanelTitle title="Garimpador" description="Busca os anuncios mais relevantes por palavra-chave e categoria." />
                <TextField label="Palavra-chave" value={keyword} onChange={setKeyword} placeholder="Ex: toner hp 105a" />
                <TextField label="Categoria" value={categoryId} onChange={setCategoryId} placeholder="Opcional, ex: MLB1234" />
                <SelectField
                  label="Ordenacao"
                  value={sort}
                  onChange={setSort}
                  options={[
                    ["", "Relevancia padrao"],
                    ["price_asc", "Menor preco"],
                    ["price_desc", "Maior preco"],
                    ["sold_quantity_desc", "Mais vendidos"],
                  ]}
                />
                <ActionButton
                  loading={loading === "keyword_search"}
                  onClick={() => runAction("keyword_search", { query: keyword, categoryId, sort, limit: 30 })}
                />
              </div>
            )}

            {activeTool === "listing_analysis" && (
              <div className="space-y-4">
                <PanelTitle title="Analise de anuncio" description="Analisa um anuncio por link ou codigo MLB." />
                <TextAreaField label="Link ou MLB" value={listingInput} onChange={setListingInput} placeholder="https://produto.mercadolivre.com.br/MLB-..." />
                <ActionButton
                  loading={loading === "listing_analysis"}
                  onClick={() => runAction("listing_analysis", { input: listingInput })}
                />
              </div>
            )}

            {activeTool === "competitor_analysis" && (
              <div className="space-y-4">
                <PanelTitle title="Analise de concorrencia" description="Mapeia o vendedor por tras de um anuncio concorrente." />
                <TextAreaField label="Link ou MLB concorrente" value={competitorInput} onChange={setCompetitorInput} placeholder="MLB1234567890" />
                <ActionButton
                  loading={loading === "competitor_analysis"}
                  onClick={() => runAction("competitor_analysis", { input: competitorInput })}
                />
              </div>
            )}

            {activeTool === "rank_analysis" && (
              <div className="space-y-4">
                <PanelTitle title="Ranking por MLB" description="Procura a posicao do anuncio na busca do Mercado Livre." />
                <TextField label="MLB do anuncio" value={rankItemId} onChange={setRankItemId} placeholder="MLB1234567890" />
                <TextField label="Palavra-chave" value={rankQuery} onChange={setRankQuery} placeholder="Ex: impressora termica" />
                <TextField label="Categoria" value={categoryId} onChange={setCategoryId} placeholder="Opcional" />
                <ActionButton
                  loading={loading === "rank_analysis"}
                  onClick={() => runAction("rank_analysis", { itemId: rankItemId, query: rankQuery, categoryId, maxPages: 10 })}
                />
              </div>
            )}

            {activeTool === "auto_pricer" && (
              <div className="space-y-4">
                <PanelTitle title="Precificador automatico" description="Calcula preco sugerido com base em anuncios concorrentes." />
                <TextAreaField label="MLBs concorrentes" value={competitorIds} onChange={setCompetitorIds} placeholder={"MLB123\nMLB456"} />
                <div className="grid grid-cols-2 gap-3">
                  <TextField label="Preco minimo" value={minPrice} onChange={setMinPrice} placeholder="Opcional" />
                  <TextField label="Preco maximo" value={maxPrice} onChange={setMaxPrice} placeholder="Opcional" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <TextField label="Desconto %" value={discountPercent} onChange={setDiscountPercent} placeholder="1" />
                  <TextField label="Arredondar" value={roundTo} onChange={setRoundTo} placeholder="0.01" />
                </div>
                <ActionButton
                  loading={loading === "auto_pricer"}
                  onClick={() =>
                    runAction("auto_pricer", {
                      competitorItemIds: readLines(competitorIds),
                      minPrice,
                      maxPrice,
                      discountPercent,
                      roundTo,
                    })
                  }
                />
              </div>
            )}

            {activeTool === "catalog_overview" && (
              <div className="space-y-4">
                <PanelTitle title="Catalogos" description="Resume seus anuncios vinculados, pendentes e disputas por produto de catalogo." />
                <ActionButton
                  loading={loading === "catalog_overview"}
                  label="Atualizar visao de catalogos"
                  onClick={() => runAction("catalog_overview")}
                />
              </div>
            )}
          </div>

          <div className="min-h-[520px] rounded-lg border border-border bg-card p-5 shadow-sm">
            {!activeResult ? (
              <div className="flex h-full min-h-[480px] flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                <Search className="h-10 w-10 text-primary/70" />
                <p className="max-w-md text-sm leading-6">
                  Execute uma consulta para ver resultados reais aqui. Nenhum bloco desta tela usa dados mockados.
                </p>
              </div>
            ) : (
              <ResultRenderer activeTool={activeTool} result={activeResult} />
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function PanelTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-1">
      <h3 className="text-lg font-black text-foreground">{title}</h3>
      <p className="text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}

function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary"
      />
    </label>
  );
}

function TextAreaField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={5}
        className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition focus:border-primary"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function ActionButton({ loading, onClick, label = "Executar consulta" }: { loading: boolean; onClick: () => void; label?: string }) {
  return (
    <Button onClick={onClick} disabled={loading} className="w-full rounded-md font-bold">
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />}
      {label}
    </Button>
  );
}

function ResultRenderer({ activeTool, result }: { activeTool: ToolKey; result: any }) {
  if (activeTool === "keyword_search") {
    return (
      <div className="space-y-4">
        <ResultHeader title="Resultados encontrados" meta={`${result.results?.length || 0} anuncios`} />
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-3 py-3 text-left">Rank</th>
                <th className="px-3 py-3 text-left">Anuncio</th>
                <th className="px-3 py-3 text-right">Preco</th>
                <th className="px-3 py-3 text-right">Venda</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(result.results || []).map((item: any) => (
                <tr key={item.itemId} className="align-top">
                  <td className="px-3 py-3 font-bold text-primary">#{item.rank}</td>
                  <td className="px-3 py-3">
                    <a href={item.permalink} target="_blank" className="font-semibold text-foreground hover:text-primary">
                      {item.title}
                    </a>
                    <div className="mt-1 text-xs text-muted-foreground">{item.itemId}</div>
                  </td>
                  <td className="px-3 py-3 text-right font-bold">{formatMoney(item.price, item.currencyId || "BRL")}</td>
                  <td className="px-3 py-3 text-right">{item.soldQuantity ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (activeTool === "listing_analysis") {
    return <ListingAnalysis result={result} />;
  }

  if (activeTool === "competitor_analysis") {
    return (
      <div className="space-y-5">
        <ListingAnalysis result={result.item} compact />
        <ResultHeader title={result.seller?.nickname || "Vendedor"} meta={`ID ${result.seller?.id || "-"}`} />
        <MetricGrid
          metrics={[
            ["Anuncios lidos", result.sellerPortfolio?.sampledListings],
            ["Menor preco", formatMoney(result.sellerPortfolio?.minPrice)],
            ["Maior preco", formatMoney(result.sellerPortfolio?.maxPrice)],
            ["Media", formatMoney(result.sellerPortfolio?.averagePrice)],
          ]}
        />
        <SimpleListingTable listings={result.sellerPortfolio?.listings || []} />
      </div>
    );
  }

  if (activeTool === "rank_analysis") {
    return (
      <div className="space-y-5">
        <ResultHeader title={result.found ? "Anuncio encontrado" : "Anuncio nao encontrado"} meta={`Busca ate ${result.searchedUntil} posicoes`} />
        <MetricGrid
          metrics={[
            ["Encontrado", result.found ? "Sim" : "Nao"],
            ["Posicao", result.rank ? `#${result.rank}` : "-"],
            ["MLB", result.item?.itemId || "-"],
          ]}
        />
        {result.item && <SimpleListingTable listings={[result.item]} />}
      </div>
    );
  }

  if (activeTool === "auto_pricer") {
    return (
      <div className="space-y-5">
        <ResultHeader title="Preco recomendado" meta={result.recommendation ? formatMoney(result.recommendation.suggestedPrice) : result.reason} />
        {result.recommendation && (
          <MetricGrid
            metrics={[
              ["Referencia", formatMoney(result.recommendation.referencePrice)],
              ["Sugerido", formatMoney(result.recommendation.suggestedPrice)],
              ["Menor concorrente", formatMoney(result.recommendation.minCompetitorPrice)],
              ["Media concorrente", formatMoney(result.recommendation.averageCompetitorPrice)],
            ]}
          />
        )}
        <SimpleListingTable listings={result.competitors || []} />
      </div>
    );
  }

  if (activeTool === "catalog_overview") {
    return (
      <div className="space-y-5">
        <ResultHeader title="Visao de catalogos" meta={`${result.summary?.total || 0} anuncios locais`} />
        <MetricGrid
          metrics={[
            ["Vinculados", result.summary?.linked],
            ["Pendentes", result.summary?.pending],
            ["Catalogos disputados", result.summary?.contestedCatalogs],
          ]}
        />
        <div className="grid gap-4 xl:grid-cols-2">
          <CatalogList title="Pendentes para vincular" listings={result.pending || []} />
          <CatalogList title="Disputas locais" listings={(result.contestedCatalogs || []).flatMap((catalog: any) => catalog.items || [])} />
        </div>
      </div>
    );
  }

  return <pre className="overflow-auto rounded-lg bg-muted p-4 text-xs">{JSON.stringify(result, null, 2)}</pre>;
}

function ResultHeader({ title, meta }: { title: string; meta?: string }) {
  return (
    <div className="flex flex-col gap-2 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
      <h3 className="text-xl font-black text-foreground">{title}</h3>
      {meta && <span className="rounded-md bg-muted px-3 py-1 text-xs font-bold text-muted-foreground">{meta}</span>}
    </div>
  );
}

function MetricGrid({ metrics }: { metrics: Array<[string, React.ReactNode]> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map(([label, value]) => (
        <div key={label} className="rounded-lg border border-border bg-background p-4">
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</div>
          <div className="mt-2 text-lg font-black text-foreground">{value ?? "-"}</div>
        </div>
      ))}
    </div>
  );
}

function ListingAnalysis({ result, compact = false }: { result: any; compact?: boolean }) {
  return (
    <div className="space-y-5">
      <ResultHeader title={result.title || result.itemId} meta={result.itemId} />
      <MetricGrid
        metrics={[
          ["Preco", formatMoney(result.price, result.currencyId || "BRL")],
          ["Status", result.status || "-"],
          ["Vendidos", result.soldQuantity ?? "-"],
          ["Saude", result.health ?? "-"],
        ]}
      />
      {!compact && (
        <div className="grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)]">
          {result.thumbnail ? (
            <img src={result.thumbnail} alt="" className="h-44 w-full rounded-lg border border-border object-cover" />
          ) : (
            <div className="h-44 rounded-lg border border-border bg-muted" />
          )}
          <div className="space-y-3 text-sm">
            <InfoRow label="Categoria" value={result.categoryId} />
            <InfoRow label="Catalogo" value={result.catalogProductId || "Nao vinculado"} />
            <InfoRow label="Tipo" value={result.listingTypeId} />
            <InfoRow label="Estoque" value={result.availableQuantity} />
            {result.permalink && (
              <a href={result.permalink} target="_blank" className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline">
                Abrir anuncio <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>
        </div>
      )}
      {result.priceToWin && (
        <pre className="max-h-64 overflow-auto rounded-lg bg-muted p-4 text-xs">
          {JSON.stringify(result.priceToWin, null, 2)}
        </pre>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-semibold text-foreground">{value ?? "-"}</span>
    </div>
  );
}

function SimpleListingTable({ listings }: { listings: any[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/60 text-xs uppercase tracking-widest text-muted-foreground">
          <tr>
            <th className="px-3 py-3 text-left">Anuncio</th>
            <th className="px-3 py-3 text-right">Preco</th>
            <th className="px-3 py-3 text-right">Vendidos</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {listings.map((item) => (
            <tr key={item.itemId} className="align-top">
              <td className="px-3 py-3">
                {item.permalink ? (
                  <a href={item.permalink} target="_blank" className="font-semibold text-foreground hover:text-primary">
                    {item.title || item.itemId}
                  </a>
                ) : (
                  <span className="font-semibold">{item.title || item.itemId}</span>
                )}
                {item.error && <div className="mt-1 text-xs text-destructive">{item.error}</div>}
                <div className="mt-1 text-xs text-muted-foreground">{item.itemId}</div>
              </td>
              <td className="px-3 py-3 text-right font-bold">{formatMoney(item.price, item.currencyId || "BRL")}</td>
              <td className="px-3 py-3 text-right">{item.soldQuantity ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CatalogList({ title, listings }: { title: string; listings: any[] }) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <h4 className="mb-3 text-sm font-black uppercase tracking-widest text-muted-foreground">{title}</h4>
      <div className="max-h-96 space-y-3 overflow-auto">
        {listings.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum item encontrado.</p>
        ) : (
          listings.slice(0, 30).map((item) => (
            <div key={item.id || item.mlItemId} className="flex gap-3 border-b border-border/60 pb-3 last:border-0">
              {item.thumbnail ? <img src={item.thumbnail} alt="" className="h-12 w-12 rounded-md object-cover" /> : <div className="h-12 w-12 rounded-md bg-muted" />}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-foreground">{item.title}</div>
                <div className="mt-1 text-xs text-muted-foreground">{item.mlItemId || item.itemId}</div>
              </div>
              <div className="text-right text-sm font-bold">{formatMoney(item.price)}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
