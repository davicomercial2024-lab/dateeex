"use client";

import React, { useState } from "react";
import { Sparkles, X, ChevronRight, AlertTriangle, CheckCircle, BrainCircuit, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AIAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaigns: any[];
  summary: any;
}

export function AIAnalysisModal({ isOpen, onClose, campaigns, summary }: AIAnalysisModalProps) {
  const [analysis, setAnalysis] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAnalyze = async () => {
    setIsLoading(true);
    setError("");
    setAnalysis(null);

    try {
      const res = await fetch("/api/ai/ads-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaigns, summary }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao processar análise.");

      setAnalysis(data.analysis);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl mx-4 rounded-2xl border border-border/60 bg-card shadow-2xl p-6 flex flex-col max-h-[85vh]">
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-accent text-muted-foreground transition-colors">
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <BrainCircuit className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Especialista IA</h2>
            <p className="text-xs text-muted-foreground">Análise inteligente das suas campanhas de Mercado Livre Ads.</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 space-y-6">
          {!analysis && !isLoading && !error && (
            <div className="text-center py-10 space-y-4">
              <Sparkles className="w-12 h-12 text-muted-foreground/30 mx-auto" />
              <p className="text-sm text-muted-foreground">
                A Inteligência Artificial do Datex está pronta para auditar seu ACOS, orçamentos e performance diária.
              </p>
              <Button onClick={handleAnalyze} className="gap-2 shadow-lg shadow-primary/20">
                <Sparkles className="w-4 h-4" /> Gerar Diagnóstico Agora
              </Button>
            </div>
          )}

          {isLoading && (
            <div className="text-center py-16 space-y-4 animate-pulse">
              <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto" />
              <p className="text-sm text-muted-foreground font-medium tracking-wide">
                Processando dados em tempo real na OpenAI...
              </p>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {analysis && (
            <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
              {/* Diagnóstico Global */}
              <div className="p-4 rounded-xl border border-primary/20 bg-primary/5">
                <h3 className="text-xs font-bold uppercase tracking-widest text-primary mb-2 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" /> Diagnóstico Global
                </h3>
                <p className="text-sm text-foreground/90 leading-relaxed">
                  {analysis.globalDiagnostic}
                </p>
              </div>

              {/* Pontos Críticos */}
              {analysis.criticalIssues && analysis.criticalIssues.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-destructive mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> Pontos de Atenção
                  </h3>
                  <ul className="space-y-2">
                    {analysis.criticalIssues.map((issue: string, idx: number) => (
                      <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2 bg-destructive/5 p-2.5 rounded-lg border border-destructive/10">
                        <span className="w-1.5 h-1.5 rounded-full bg-destructive mt-1.5 shrink-0" />
                        {issue}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Passos Acionáveis */}
              {analysis.actionableSteps && analysis.actionableSteps.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-500 mb-3 flex items-center gap-2">
                    <ChevronRight className="w-4 h-4" /> Recomendações Práticas
                  </h3>
                  <div className="space-y-3">
                    {analysis.actionableSteps.map((step: any, idx: number) => (
                      <div key={idx} className="p-3.5 rounded-xl border border-border/50 bg-secondary/30">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="px-2 py-0.5 rounded-md bg-background text-[10px] font-bold uppercase border border-border text-foreground">
                            {step.campaignName}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-foreground mb-1">{step.action}</p>
                        <p className="text-xs text-muted-foreground">{step.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 mt-2 border-t border-border/40 flex justify-between items-center">
          <p className="text-[10px] text-muted-foreground font-mono">Powered by GPT-4o-Mini</p>
          {analysis && (
            <Button variant="outline" onClick={handleAnalyze} size="sm" className="gap-2 text-xs h-8">
              <RefreshCw className="w-3.5 h-3.5" /> Reanalisar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
