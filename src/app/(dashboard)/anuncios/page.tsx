"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckSquare, Eye, RefreshCw, Search, ShoppingBag, ShoppingCart } from "lucide-react";
import { useMeli } from "@/context/meli-context";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

interface AdvancedListing {
  id: string;
  mlItemId: string;
  title: string;
  price: number;
  thumbnail: string;
  permalink: string;
  status: string;
  availableQuantity: number;
  condition: string | null;
  shipping: string | null;
  youReceive: number;
  quality: number;
  visits7d: number | null;
  sales7d: number | null;
  recommendations: string[];
}

export default function AnunciosPage() {
  const { accounts, selectedAccountId, isSyncing, triggerSync } = useMeli();

  const [listings, setListings] = useState<AdvancedListing[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<"active" | "paused" | null>(null);

  const fetchListings = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/listings/advanced?accountId=${selectedAccountId}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Erro ao carregar anuncios.");
      setListings(data.listings || []);
      setSelectedIds(new Set());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [selectedAccountId]);

  useEffect(() => {
    if (accounts.length > 0) fetchListings();
  }, [accounts.length, fetchListings]);

  const filtered = listings.filter((listing) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return listing.title.toLowerCase().includes(term) || listing.mlItemId.toLowerCase().includes(term);
  });

  const warningCards = [
    {
      label: "Qualidade abaixo do ideal",
      count: listings.filter((listing) => listing.quality < 70).length,
      desc: "Revise fotos, ficha tecnica e recomendacoes retornadas pela integracao.",
    },
    {
      label: "Risco operacional",
      count: listings.filter((listing) => ["under_review", "inactive"].includes(listing.status)).length,
      desc: "Acompanhe anuncios em revisao ou inativos antes de operar em massa.",
    },
    {
      label: "Pausados ou fechados",
      count: listings.filter((listing) => ["paused", "closed"].includes(listing.status)).length,
      desc: "Veja anuncios que nao estao vendendo ativamente.",
    },
  ];

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(filtered.map((listing) => listing.id)));
  };

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleBulkStatus = async (status: "active" | "paused") => {
    if (selectedIds.size === 0 || bulkAction) return;

    setBulkAction(status);
    setError(null);

    try {
      const res = await fetch("/api/listings/bulk-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || "Nao foi possivel atualizar os anuncios.");

      const failed = data.summary?.errorCount ?? 0;
      if (failed > 0) {
        setError(`${failed} anuncio(s) nao foram atualizados. Verifique a conta no Mercado Livre.`);
      }

      await fetchListings();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido.";
      setError(message);
    } finally {
      setBulkAction(null);
    }
  };

  const formatBRL = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  if (accounts.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl md:text-2xl font-extrabold tracking-tight">Gestao de Anuncios</h1>
        <EmptyState
          title="Nenhuma conta conectada"
          description="Vincule sua conta do Mercado Livre."
          icon={ShoppingBag}
          pageName="Anuncios"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border/40 pb-4">
        <div className="flex gap-6">
          <span className="pb-4 font-bold text-sm text-primary border-b-2 border-primary">Gestao de anuncios</span>
          <Link href="/promocoes" className="pb-4 font-semibold text-sm text-muted-foreground hover:text-foreground">
            Central de promocoes
          </Link>
          <Link href="/publicidade" className="pb-4 font-semibold text-sm text-muted-foreground hover:text-foreground">
            Publicidade
          </Link>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2 hide-scrollbar">
        {warningCards.map((card) => (
          <div key={card.label} className="min-w-[280px] p-4 rounded-lg bg-card border border-border/50 shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-bold text-foreground leading-tight max-w-[180px]">{card.label}</span>
              <span className="px-2 py-0.5 rounded-md bg-secondary text-xs font-bold text-muted-foreground">
                {card.count}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground truncate">{card.desc}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row justify-between gap-4 items-center mt-2">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por titulo, codigo ou SKU"
            className="w-full pl-9 pr-4 py-2 rounded-full border border-border/60 bg-card text-xs focus:ring-1 focus:ring-primary/50 outline-none"
          />
        </div>

        <div className="flex items-center gap-4">
          <div className="text-xs text-muted-foreground">{filtered.length.toLocaleString("pt-BR")} anuncios</div>
          <Button
            onClick={async () => {
              await triggerSync();
              await fetchListings();
            }}
            disabled={isSyncing || isLoading}
            size="sm"
            className="rounded-xl text-xs font-bold gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "Sincronizando..." : "Sincronizar ML"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs font-semibold text-destructive">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-secondary/20 mt-4">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={selectedIds.size > 0 && selectedIds.size === filtered.length}
            ref={(input) => {
              if (input) input.indeterminate = selectedIds.size > 0 && selectedIds.size < filtered.length;
            }}
            onChange={toggleSelectAll}
            className="w-4 h-4 rounded border-border/60 bg-card text-primary focus:ring-0"
          />
          <span className="text-xs font-bold text-foreground">Selecionar anuncios</span>
        </div>
        <div className="flex items-center gap-4 text-xs font-bold text-muted-foreground">
          <button
            onClick={() => handleBulkStatus("paused")}
            className="hover:text-foreground transition-colors disabled:opacity-50"
            disabled={selectedIds.size === 0 || bulkAction !== null}
          >
            {bulkAction === "paused" ? "Pausando..." : "Pausar"}
          </button>
          <button
            onClick={() => handleBulkStatus("active")}
            className="hover:text-foreground transition-colors disabled:opacity-50"
            disabled={selectedIds.size === 0 || bulkAction !== null}
          >
            {bulkAction === "active" ? "Reativando..." : "Reativar"}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-20 gap-4 border border-border/40 rounded-xl bg-card">
          <RefreshCw className="w-8 h-8 text-primary animate-spin" />
          <span className="text-xs text-muted-foreground font-medium">Buscando qualidade e indicadores dos anuncios...</span>
        </div>
      ) : (
        <div className="border border-border/60 rounded-xl overflow-x-auto bg-card shadow-sm">
          <table className="w-full text-left text-xs min-w-[1000px]">
            <thead className="bg-secondary/30 text-[10px] font-bold text-muted-foreground uppercase tracking-widest border-b border-border/40">
              <tr>
                <th className="px-4 py-3 w-10 text-center" />
                <th className="px-4 py-3 w-[280px]">Anuncio</th>
                <th className="px-4 py-3">Preco</th>
                <th className="px-4 py-3">Condicoes</th>
                <th className="px-4 py-3">Voce recebe</th>
                <th className="px-4 py-3">Metricas ult. 7 dias</th>
                <th className="px-4 py-3 text-center">Qualidade</th>
                <th className="px-4 py-3 text-center">Experiencia</th>
                <th className="px-4 py-3">Status e recomendacoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {filtered.map((listing) => (
                <tr key={listing.id} className="hover:bg-muted/10 transition-colors group">
                  <td className="px-4 py-4 text-center align-top">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(listing.id)}
                      onChange={() => toggleSelectOne(listing.id)}
                      className="w-4 h-4 rounded border-border/60 text-primary focus:ring-0 mt-1"
                    />
                  </td>
                  <td className="px-4 py-4 align-top">
                    <div className="flex gap-3">
                      <img src={listing.thumbnail} alt={listing.title} className="w-12 h-12 rounded object-cover border border-border/40" />
                      <div className="space-y-1 min-w-0">
                        <p className="font-semibold text-foreground/90 leading-tight line-clamp-2" title={listing.title}>
                          {listing.title}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-mono">#{listing.mlItemId}</p>
                        <p className="text-[10px] text-muted-foreground">Estoque: {listing.availableQuantity} u.</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 align-top font-bold text-foreground text-sm">{formatBRL(listing.price)}</td>
                  <td className="px-4 py-4 align-top text-[10px] space-y-1">
                    <p className="font-semibold text-foreground">{listing.condition || "Nao informado"}</p>
                    <p className="text-muted-foreground">Voce oferece</p>
                    <p className="text-foreground">{listing.shipping || "Nao informado"}</p>
                  </td>
                  <td className="px-4 py-4 align-top text-sm font-semibold text-foreground">{formatBRL(listing.youReceive)}</td>
                  <td className="px-4 py-4 align-top space-y-1 text-muted-foreground font-medium">
                    <p className="flex items-center gap-1.5"><Eye className="w-3.5 h-3.5" /> {listing.visits7d ?? "Indisponivel"}</p>
                    <p className="flex items-center gap-1.5"><ShoppingCart className="w-3.5 h-3.5" /> {listing.sales7d ?? "Indisponivel"}</p>
                  </td>
                  <td className="px-4 py-4 align-top text-center">
                    <div className="inline-flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full border-[3px] border-emerald-500 flex items-center justify-center text-sm font-black text-emerald-500 mb-1">
                        {Math.round(listing.quality)}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 align-top text-center">
                    <div className="flex flex-col items-center justify-center text-emerald-500 gap-1 mt-1">
                      <CheckSquare className="w-5 h-5 fill-emerald-500/20" />
                      <span className="text-[9px] font-bold">OK</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <div className="space-y-1">
                      <p className="font-bold text-foreground leading-tight">{listing.status}</p>
                      <p className="text-[10px] text-muted-foreground leading-tight">
                        {listing.recommendations.length > 0
                          ? listing.recommendations.slice(0, 2).join(", ")
                          : "Sem recomendacoes pendentes."}
                      </p>
                      <Link href="/promocoes" className="inline-flex px-3 py-1 rounded bg-blue-50 text-blue-600 dark:bg-blue-600/10 dark:text-blue-500 text-[10px] font-bold mt-2 hover:bg-blue-100 dark:hover:bg-blue-600/20 transition-colors">
                        Ver promocoes
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
