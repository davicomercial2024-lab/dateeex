"use client";

import React, { useState } from "react";
import { LucideIcon, ShieldCheck, Zap, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMeli } from "@/context/meli-context";

interface EmptyStateProps {
  title: string;
  description: string;
  icon: LucideIcon;
  pageName: string;
}

export function EmptyState({ title, description, icon: Icon, pageName }: EmptyStateProps) {
  const { connectViaOAuth } = useMeli();
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState("");

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      setError("");
      await connectViaOAuth(); // redireciona para o Mercado Livre — não retorna
    } catch (err: any) {
      setError(err.message || "Falha ao iniciar a autorização OAuth.");
      setIsConnecting(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center text-center p-8 min-h-[500px] border border-dashed border-border rounded-xl bg-card/40 backdrop-blur-sm max-w-3xl mx-auto my-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-6 shadow-inner">
        <Icon className="w-8 h-8" />
      </div>

      <h3 className="text-xl font-bold text-foreground mb-3">{title}</h3>
      <p className="text-muted-foreground text-sm max-w-md mb-8 leading-relaxed">{description}</p>

      {error && (
        <p className="mb-4 text-xs text-destructive font-semibold bg-destructive/5 border border-destructive/20 rounded-xl px-4 py-2">
          {error}
        </p>
      )}

      <div className="flex flex-col sm:flex-row gap-3 items-center justify-center mb-8">
        <Button
          onClick={handleConnect}
          disabled={isConnecting}
          className="w-full sm:w-auto font-semibold px-6 shadow-md transition-all hover:scale-[1.02] gap-2"
        >
          {isConnecting ? (
            <><RefreshCw className="w-4 h-4 animate-spin" />Redirecionando...</>
          ) : (
            <><ExternalLink className="w-4 h-4" />Conectar conta Mercado Livre</>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left w-full border-t border-border pt-8 max-w-lg">
        <div className="flex items-start gap-3">
          <div className="p-1 rounded bg-secondary text-primary mt-0.5">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-foreground">Conexão Oficial OAuth 2.0</h4>
            <p className="text-[11px] text-muted-foreground leading-normal mt-0.5">
              Integração certificada. Não armazenamos sua senha do Mercado Livre.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="p-1 rounded bg-secondary text-primary mt-0.5">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-foreground">Sincronização Automática</h4>
            <p className="text-[11px] text-muted-foreground leading-normal mt-0.5">
              Seus dados de vendas, anúncios e perguntas são sincronizados automaticamente.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
