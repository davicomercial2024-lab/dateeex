"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  ShoppingBag, RefreshCw, Tag, PauseCircle, AlertTriangle, CheckSquare, Edit, Download,
  ExternalLink, Search, LayoutGrid, LayoutList, ChevronDown, Activity, ShieldCheck, 
  Settings2, Eye, ShoppingCart
} from "lucide-react";
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
  quality: number; // 0 to 100
  visits7d: number | null;
  sales7d: number | null;
  recommendations: string[];
}

export default function AnunciosPage() {
  const { accounts, selectedAccountId, selectedAccount, isSyncing, triggerSync } = useMeli();

  const [listings, setListings] = useState<AdvancedListing[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const fetchListings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/listings/advanced?accountId=${selectedAccountId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao carregar anúncios.");
      setListings(data.listings || []);
      setSelectedIds(new Set()); // Limpa seleções ao recarregar
    } catch (err: any) {
      setError(err.message || "Erro desconhecido.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedAccountId]);

  useEffect(() => {
    if (accounts.length > 0) fetchListings();
  }, [selectedAccountId, accounts.length, fetchListings]);

  if (accounts.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl md:text-2xl font-extrabold tracking-tight">Gestão de Anúncios</h1>
        <EmptyState title="Nenhuma conta conectada" description="Vincule sua conta do Mercado Livre." icon={ShoppingBag} pageName="Anúncios" />
      </div>
    );
  }

  const filtered = listings.filter((l) =>
    search === "" || l.title.toLowerCase().includes(search.toLowerCase()) || l.mlItemId.toLowerCase().includes(search.toLowerCase())
  );

  const warningCards = [
    {
      label: "Com qualidade abaixo do ideal",
      count: listings.filter((listing) => listing.quality < 70).length,
      desc: "Revise fotos, ficha técnica e recomendações retornadas pela integração.",
    },
    {
      label: "Com risco operacional",
      count: listings.filter((listing) => ["under_review", "inactive"].includes(listing.status)).length,
      desc: "Verifique anúncios em revisão ou inativos antes de operar em massa.",
    },
    {
      label: "Pausados ou fechados",
      count: listings.filter((listing) => ["paused", "closed"].includes(listing.status)).length,
      desc: "Acompanhe anúncios que não estão vendendo ativamente.",
    },
  ];

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(l => l.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const formatBRL = (val: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      
      {/* HEADER TABS REPLICANDO ML */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border/40 pb-4">
        <div className="flex gap-6">
          <button className="pb-4 font-bold text-sm text-primary border-b-2 border-primary">Gestão de anúncios</button>
          <button className="pb-4 font-semibold text-sm text-muted-foreground hover:text-foreground">Central de promoções</button>
          <button className="pb-4 font-semibold text-sm text-muted-foreground hover:text-foreground">Gestão de preços</button>
          <button className="pb-4 font-semibold text-sm text-muted-foreground hover:text-foreground">Gestão de estoque Full</button>
        </div>
      </div>

      {/* WARNING CARDS */}
      <div className="flex gap-4 overflow-x-auto pb-2 hide-scrollbar">
        {warningCards.map((card, idx) => (
          <div key={idx} className="min-w-[280px] p-4 rounded-lg bg-card border border-border/50 shadow-sm flex flex-col justify-between hover:border-primary/30 transition-colors cursor-pointer">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-bold text-foreground leading-tight max-w-[180px]">{card.label}</span>
              <span className="px-2 py-0.5 rounded-md bg-secondary text-xs font-bold text-muted-foreground">{card.count}</span>
            </div>
            <p className="text-[10px] text-muted-foreground truncate">{card.desc}</p>
          </div>
        ))}
      </div>

      {/* FILTER BAR & SEARCH */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-center mt-2">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por título, código ou SKU"
              className="w-full pl-9 pr-4 py-2 rounded-full border border-border/60 bg-card text-xs focus:ring-1 focus:ring-primary/50 outline-none"
            />
          </div>
          <Button variant="ghost" className="text-xs gap-2 hidden sm:flex text-foreground/80 font-bold">
            <Settings2 className="w-4 h-4" /> Filtrar e ordenar
          </Button>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-xs text-muted-foreground">
            {filtered.length.toLocaleString("pt-BR")} anúncios
          </div>
          <Button
            onClick={async () => { await triggerSync(); await fetchListings(); }}
            disabled={isSyncing || isLoading}
            size="sm"
            className="rounded-xl text-xs font-bold gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "Sincronizando..." : "Sincronizar ML"}
          </Button>
        </div>
      </div>

      {/* BULK ACTIONS BAR (Only shows if selected or as a header) */}
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
          <span className="text-xs font-bold text-foreground">Selecionar anúncios</span>
        </div>
        <div className="flex items-center gap-4 text-xs font-bold text-muted-foreground">
          <button className="hover:text-foreground transition-colors disabled:opacity-50" disabled={selectedIds.size === 0}>Pausar</button>
          <button className="hover:text-foreground transition-colors disabled:opacity-50" disabled={selectedIds.size === 0}>Reativar</button>
          <button className="hover:text-foreground transition-colors disabled:opacity-50" disabled={selectedIds.size === 0}>Excluir</button>
          <div className="w-px h-4 bg-border/60 mx-2" />
          <button className="flex items-center gap-1 text-primary hover:text-primary/80 transition-colors">
            Alterar no Editor em massa <ChevronDown className="w-3.5 h-3.5" />
          </button>
          <button className="flex items-center gap-1 text-primary hover:text-primary/80 transition-colors hidden md:flex">
            Alterar pelo Excel <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ADVANCED TABLE */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-20 gap-4 border border-border/40 rounded-xl bg-card">
          <RefreshCw className="w-8 h-8 text-primary animate-spin" />
          <span className="text-xs text-muted-foreground font-medium">Buscando qualidade e calculando indicadores de seus anúncios...</span>
        </div>
      ) : (
        <div className="border border-border/60 rounded-xl overflow-x-auto bg-card shadow-sm">
          <table className="w-full text-left text-xs min-w-[1000px]">
            <thead className="bg-secondary/30 text-[10px] font-bold text-muted-foreground uppercase tracking-widest border-b border-border/40">
              <tr>
                <th className="px-4 py-3 w-10 text-center"></th>
                <th className="px-4 py-3 w-[280px]">Anúncio</th>
                <th className="px-4 py-3">Preço</th>
                <th className="px-4 py-3">Condições</th>
                <th className="px-4 py-3">Você recebe</th>
                <th className="px-4 py-3">Métricas últ. 7 dias</th>
                <th className="px-4 py-3 text-center">Qualidade</th>
                <th className="px-4 py-3 text-center">Experiência</th>
                <th className="px-4 py-3">Status e recomendações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {filtered.map(l => (
                <tr key={l.id} className="hover:bg-muted/10 transition-colors group">
                  <td className="px-4 py-4 text-center align-top">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(l.id)}
                      onChange={() => toggleSelectOne(l.id)}
                      className="w-4 h-4 rounded border-border/60 text-primary focus:ring-0 mt-1"
                    />
                  </td>
                  <td className="px-4 py-4 align-top">
                    <div className="flex gap-3">
                      <img src={l.thumbnail} alt={l.title} className="w-12 h-12 rounded object-cover border border-border/40" />
                      <div className="space-y-1 min-w-0">
                        <p className="font-semibold text-foreground/90 leading-tight line-clamp-2" title={l.title}>{l.title}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">#{l.mlItemId}</p>
                        <p className="text-[10px] text-muted-foreground">Estoque: {l.availableQuantity} u.</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 align-top font-bold text-foreground text-sm">
                    {formatBRL(l.price)}
                  </td>
                  <td className="px-4 py-4 align-top text-[10px] space-y-1">
                    <p className="font-semibold text-foreground">{l.condition || "Não informado"}</p>
                    <p className="text-muted-foreground">Você oferece</p>
                    <p className="text-foreground">{l.shipping || "Não informado"}</p>
                  </td>
                  <td className="px-4 py-4 align-top text-sm font-semibold text-foreground">
                    {formatBRL(l.youReceive)}
                  </td>
                  <td className="px-4 py-4 align-top space-y-1 text-muted-foreground font-medium">
                    <p className="flex items-center gap-1.5"><Eye className="w-3.5 h-3.5" /> {l.visits7d ?? "Indisponível"}</p>
                    <p className="flex items-center gap-1.5"><ShoppingCart className="w-3.5 h-3.5" /> {l.sales7d ?? "Indisponível"}</p>
                  </td>
                  <td className="px-4 py-4 align-top text-center">
                    <div className="inline-flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full border-[3px] border-emerald-500 flex items-center justify-center text-sm font-black text-emerald-500 mb-1">
                        {l.quality}
                      </div>
                      <span className="text-[9px] text-primary hover:underline cursor-pointer font-bold">1 objetivo</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 align-top text-center">
                    <div className="flex flex-col items-center justify-center text-emerald-500 gap-1 mt-1">
                      <CheckSquare className="w-5 h-5 fill-emerald-500/20" />
                      <span className="text-[9px] font-bold">Muito bem!</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <p className="font-bold text-foreground leading-tight">Participe de uma promoção</p>
                        <p className="text-[10px] text-muted-foreground leading-tight">Ofereça descontos para receber mais visitas.</p>
                        <button className="px-3 py-1 rounded bg-blue-50 text-blue-600 dark:bg-blue-600/10 dark:text-blue-500 text-[10px] font-bold mt-2 hover:bg-blue-100 dark:hover:bg-blue-600/20 transition-colors">
                          Participar
                        </button>
                      </div>
                      <div className="relative inline-flex h-5 w-9 items-center rounded-full bg-blue-500 shrink-0 mt-1 cursor-pointer">
                        <span className="inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform translate-x-4" />
                      </div>
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
