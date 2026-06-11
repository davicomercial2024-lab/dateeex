"use client";

import React, { useState } from "react";
import { Edit2, Save, X, RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Campaign {
  id: number;
  name: string;
  status: string;
  budget: number;
  accountId: string;
  accountName: string;
  metrics: {
    clicks: number;
    cost: number;
    sales: number;
    roas: number;
    acos: number;
  };
}

interface CampaignsTableProps {
  campaigns: Campaign[];
  onRefresh: () => void;
}

export function CampaignsTable({ campaigns, onRefresh }: CampaignsTableProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editBudget, setEditBudget] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState<number | null>(null);

  const handleToggleStatus = async (campaign: Campaign) => {
    const newStatus = campaign.status === "active" ? "paused" : "active";
    await updateCampaign(campaign, { status: newStatus });
  };

  const handleSaveBudget = async (campaign: Campaign) => {
    const parsed = parseFloat(editBudget);
    if (isNaN(parsed) || parsed <= 0) {
      alert("Orçamento inválido");
      return;
    }
    await updateCampaign(campaign, { daily_budget: parsed });
    setEditingId(null);
  };

  const updateCampaign = async (campaign: Campaign, payload: any) => {
    setIsUpdating(campaign.id);
    try {
      const res = await fetch(`/api/ads/campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, accountId: campaign.accountId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erro ao atualizar");
      }
      
      onRefresh(); // recarrega a tabela chamando a API principal novamente
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsUpdating(null);
    }
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  return (
    <div className="w-full overflow-x-auto rounded-xl border border-border/50 bg-card/30">
      <table className="w-full text-sm text-left">
        <thead className="text-[10px] text-muted-foreground uppercase tracking-widest bg-secondary/20 border-b border-border/40">
          <tr>
            <th className="px-4 py-3 font-semibold w-12 text-center">Status</th>
            <th className="px-4 py-3 font-semibold">Nome da campanha</th>
            <th className="px-4 py-3 font-semibold">Diagnóstico</th>
            <th className="px-4 py-3 font-semibold">Orçamento diário</th>
            <th className="px-4 py-3 font-semibold">Vendas por Ads</th>
            <th className="px-4 py-3 font-semibold">ROAS</th>
            <th className="px-4 py-3 font-semibold">ACOS</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground text-xs">
                Nenhuma campanha encontrada.
              </td>
            </tr>
          ) : (
            campaigns.map((camp) => {
              const isEditing = editingId === camp.id;
              const isProcessing = isUpdating === camp.id;
              const isActive = camp.status === "active";

              let diagnosticLabel = "Em análise";
              let diagnosticColor = "text-muted-foreground";
              if (camp.metrics.acos > 0 && camp.metrics.acos < 15) {
                diagnosticLabel = "Excelente";
                diagnosticColor = "text-emerald-500";
              } else if (camp.metrics.acos >= 15 && camp.metrics.acos < 25) {
                diagnosticLabel = "Bom";
                diagnosticColor = "text-emerald-400";
              } else if (camp.metrics.acos >= 25) {
                diagnosticLabel = "Revisar";
                diagnosticColor = "text-amber-500";
              }

              return (
                <tr key={camp.id} className="border-b border-border/20 hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleToggleStatus(camp)}
                      disabled={isProcessing}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${isActive ? 'bg-emerald-500' : 'bg-muted'} ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${isActive ? 'translate-x-4' : 'translate-x-1'}`} />
                    </button>
                  </td>
                  
                  <td className="px-4 py-3">
                    <div className="font-semibold text-foreground/90 truncate max-w-[200px]" title={camp.name}>
                      {camp.name}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[200px]">
                      {camp.accountName}
                    </div>
                  </td>
                  
                  <td className={`px-4 py-3 text-xs font-bold ${diagnosticColor}`}>
                    {diagnosticLabel}
                  </td>
                  
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-xs font-bold">R$</span>
                        <input
                          type="number"
                          className="w-20 px-2 py-1 text-xs rounded border border-primary/50 bg-background text-foreground focus:outline-none"
                          value={editBudget}
                          onChange={(e) => setEditBudget(e.target.value)}
                          autoFocus
                          onKeyDown={(e) => e.key === "Enter" && handleSaveBudget(camp)}
                        />
                        <button onClick={() => handleSaveBudget(camp)} className="text-emerald-500 hover:bg-emerald-500/10 p-1 rounded">
                          <Save className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setEditingId(null)} className="text-muted-foreground hover:bg-accent p-1 rounded">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 group">
                        <span className="font-medium text-foreground/90">{formatCurrency(camp.budget)}</span>
                        <button
                          onClick={() => { setEditingId(camp.id); setEditBudget(camp.budget.toString()); }}
                          disabled={isProcessing}
                          className="text-muted-foreground/0 group-hover:text-primary transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                  
                  <td className="px-4 py-3 font-medium text-foreground/90">
                    {camp.metrics.sales > 0 ? formatCurrency(camp.metrics.sales) : "—"}
                  </td>
                  
                  <td className="px-4 py-3 font-medium text-foreground/90">
                    {camp.metrics.roas > 0 ? `${camp.metrics.roas.toFixed(2)}x` : "—"}
                  </td>
                  
                  <td className="px-4 py-3 font-bold text-foreground/90">
                    {camp.metrics.acos > 0 ? `${camp.metrics.acos.toFixed(2)}%` : "—"}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
