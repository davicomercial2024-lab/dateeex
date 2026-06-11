"use client";

import React from "react";
import { 
  Cpu, 
  RefreshCw, 
  BrainCircuit, 
  Lightbulb,
  CheckCircle2,
  TrendingUp,
  MessageSquare,
  Sparkles,
  Zap
} from "lucide-react";
import { useMeli } from "@/context/meli-context";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function IAPage() {
  const { accounts, selectedAccountId, selectedAccount } = useMeli();

  if (accounts.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl md:text-2xl font-extrabold tracking-tight text-foreground/90">
            Datex AI - Inteligência Artificial
          </h2>
          <p className="text-xs md:text-sm text-muted-foreground font-medium">
            Insights preditivos e automações de decisão para sua operação Mercado Livre.
          </p>
        </div>
        
        <EmptyState
          title="Datex AI desativado"
          description="Receba insights profundos sobre estoque crítico, sugestões de precificação inteligente, análise de sentimento em tempo real de perguntas e previsões de vendas. Vincule sua conta do Mercado Livre para alimentar nosso modelo de Machine Learning."
          icon={Cpu}
          pageName="Inteligência Artificial"
        />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-5">
        <div className="space-y-1">
          <h2 className="text-xl md:text-2xl font-extrabold tracking-tight text-foreground/90">
            Datex AI - Inteligência Artificial
          </h2>
          <p className="text-xs md:text-sm text-muted-foreground font-medium">
            {selectedAccountId === "all"
              ? `Análise preditiva consolidada de todas as ${accounts.length} conta(s)`
              : `Gestão de inteligência para a conta: ${selectedAccount?.nickname}`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 text-indigo-500 rounded-xl border border-indigo-500/20 text-xs font-bold uppercase tracking-wider">
            <BrainCircuit className="w-3.5 h-3.5 animate-pulse" />
            <span>AI Engine Online</span>
          </div>
        </div>
      </div>

      {/* AI ENGINE ANALYTICS PREDICTIONS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Demand Forecasting Skeleton Card */}
        <Card className="border-border/50 bg-[#0A0E18] text-white overflow-hidden relative shadow-lg">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
          <CardHeader className="pb-3 border-b border-white/5">
            <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-widest mb-1">
              <TrendingUp className="w-4 h-4 text-indigo-400" />
              <span>Previsão de Demanda e Estoque</span>
            </div>
            <CardTitle className="text-base font-extrabold tracking-tight">Estoque Crítico & Sazonalidade</CardTitle>
            <CardDescription className="text-xs text-white/50 mt-0.5">
              Identificação automática de riscos de ruptura de estoque nos próximos 30 dias.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-5">
            <p className="text-xs text-zinc-300 leading-relaxed font-medium">
              Nosso motor calcula o ritmo diário de vendas (`run_rate`) e cruza com os dias restantes de estoque. Assim que o catálogo for sincronizado, a rede preditiva identificará quais anúncios MLB correm o risco de perder a medalha e relevância na busca devido à ruptura de estoque.
            </p>
            
            <div className="border-t border-white/5 pt-4 flex items-center justify-between">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Status do Modelo:</span>
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-400 uppercase tracking-widest bg-indigo-500/10 py-1.5 px-2.5 rounded-lg border border-indigo-500/10">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Alimentando Modelo...</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* NLP Sentiment Analysis Skeleton Card */}
        <Card className="border-border/50 bg-[#0A0E18] text-white overflow-hidden relative shadow-lg">
          <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />
          <CardHeader className="pb-3 border-b border-white/5">
            <div className="flex items-center gap-2 text-teal-400 font-bold text-xs uppercase tracking-widest mb-1">
              <MessageSquare className="w-4 h-4 text-teal-400" />
              <span>Análise de Sentimentos</span>
            </div>
            <CardTitle className="text-base font-extrabold tracking-tight">Perguntas Pré-Venda & Comentários</CardTitle>
            <CardDescription className="text-xs text-white/50 mt-0.5">
              NLP (Processamento de Linguagem Natural) analisando a intenção de compra de potenciais compradores.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-5">
            <p className="text-xs text-zinc-300 leading-relaxed font-medium">
              Datex AI classifica automaticamente a tonalidade e sentimento de todas as perguntas que chegam às suas contas Mercado Livre. Identificamos se o lead está em estágio avançado de intenção de compra (exemplo: dúvidas sobre frete rápido) ou se é uma pergunta de suporte.
            </p>
            
            <div className="border-t border-white/5 pt-4 flex items-center justify-between">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Status do NLP:</span>
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-teal-400 uppercase tracking-widest bg-teal-500/10 py-1.5 px-2.5 rounded-lg border border-teal-500/10">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Aguardando Perguntas...</span>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* AI ENGINE CONSOLE DESCRIPTION */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm shadow-md overflow-hidden relative">
        <div className="absolute top-0 right-0 w-80 h-80 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <CardHeader className="border-b border-border/30 pb-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base font-extrabold tracking-tight text-foreground/95">Capacidades Analíticas de Datex AI</CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Modelos de machine learning preditivos desenhados especificamente para o ecossistema Mercado Livre.
              </CardDescription>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-xl border border-emerald-500/20 text-[10px] font-bold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Pronto
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-5 space-y-6">
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            
            {/* Context descriptions */}
            <div className="lg:col-span-2 space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-1.5">
                  <Lightbulb className="w-4.5 h-4.5" /> Otimização Contínua sem Viés Fictício
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                  A nossa Inteligência Artificial opera de forma rigorosamente ética e analítica: não geramos previsões, faturamentos futuros ou insights com dados fictícios. Os relatórios de Machine Learning de regressão linear serão exibidos e refinados dinamicamente à medida que as contas vinculadas carregarem seu histórico operacional.
                </p>
                <div className="text-xs font-bold text-foreground">
                  Processamento seguro local de dados em conformidade com as restrições éticas de IA.
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-4 bg-secondary/40 border border-border/50 rounded-xl text-xs text-muted-foreground/90">
                <Sparkles className="w-4.5 h-4.5 text-primary shrink-0" />
                <p className="leading-relaxed">
                  Datex AI está otimizado para classificar comportamentos sazonais como Black Friday, Natal e Dia das Mães baseando-se em tendências setoriais de e-commerce realistas.
                </p>
              </div>
            </div>

            {/* Waiting status panel */}
            <div className="p-5 rounded-2xl bg-secondary/35 border border-border/50 flex flex-col justify-between min-h-[200px]">
              <div className="space-y-2">
                <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Alimentação do Modelo</div>
                <div className="text-lg font-black tracking-tight text-foreground flex items-center gap-2">
                  <RefreshCw className="w-4.5 h-4.5 text-primary animate-spin shrink-0" />
                  <span>Calculando...</span>
                </div>
              </div>
              
              <div className="space-y-3.5 border-t border-border/40 pt-4">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[9px] font-bold text-muted-foreground">
                    <span>REGRESSÃO DE DADOS</span>
                    <span>CARREGANDO...</span>
                  </div>
                  <div className="h-1.5 w-full bg-card rounded-lg overflow-hidden border border-border/30">
                    <div className="h-full w-[15%] bg-primary rounded-lg animate-pulse" />
                  </div>
                </div>
                <p className="text-[9px] text-muted-foreground leading-relaxed">
                  Aguardando a carga completa dos anúncios e pedidos históricos da conta para iniciar previsões de demanda sem viés gerencial.
                </p>
              </div>
            </div>
          </div>

        </CardContent>
      </Card>

    </div>
  );
}
