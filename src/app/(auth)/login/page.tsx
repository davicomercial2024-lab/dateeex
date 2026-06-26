"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck, ArrowRight, Layers, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Por favor, preencha todos os campos.");
      return;
    }

    try {
      setIsLoading(true);
      setError("");
      
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Credenciais inválidas. Verifique seu e-mail e senha.");
      }
      
      localStorage.setItem("datex_logged_in", "true");
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Erro ao autenticar. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-[#0B0F19] text-white">
      {/* Left side: Form */}
      <div className="flex-1 flex flex-col justify-center px-8 md:px-16 lg:px-24 py-12">
        <div className="w-full max-w-md mx-auto">
          {/* Logo */}
          <div className="flex items-center mb-12">
            <img 
              src="/datex-logo-horizontal.svg" 
              alt="Datex Logo" 
              className="h-10 w-auto"
            />
          </div>

          {/* Titles */}
          <h2 className="text-2xl font-bold tracking-tight mb-2">Acesse sua conta</h2>
          <p className="text-sm text-muted-foreground mb-8">
            Gerencie e consolide suas operações do Mercado Livre em um só lugar.
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" /> E-mail
              </label>
              <Input
                type="email"
                placeholder="nome@empresa.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
                disabled={isLoading}
                className="bg-[#121826] border-[#1f293d] focus-visible:ring-primary text-white"
                required
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" /> Senha
                </label>
                <span className="text-xs font-medium text-muted-foreground/70">
                  Recuperacao indisponivel
                </span>
              </div>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                disabled={isLoading}
                className="bg-[#121826] border-[#1f293d] focus-visible:ring-primary text-white"
                required
              />
            </div>

            {error && <p className="text-xs font-medium text-destructive">{error}</p>}

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full font-semibold py-5 shadow-lg shadow-primary/20 bg-primary hover:bg-primary/95 text-white transition-all transform hover:scale-[1.01] mt-6"
            >
              {isLoading ? "Autenticando..." : "Entrar no Datex"}
            </Button>
          </form>

          {/* Registration link */}
          <p className="text-center text-sm text-muted-foreground mt-8">
            Ainda não tem conta?{" "}
            <Link href="/register" className="text-primary font-semibold hover:underline">
              Crie uma conta grátis
            </Link>
          </p>
        </div>
      </div>

      {/* Right side: Premium Marketing Graphic Panel (Hidden on Mobile) */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-[#121826] to-[#0A0D14] flex-col justify-between p-12 border-l border-[#1f293d] relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[#eab308]/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="flex items-center gap-1.5 text-xs text-primary font-bold uppercase tracking-widest bg-[#1a2333] border border-[#2b3a54] px-3 py-1.5 rounded-full w-fit">
          <Layers className="w-3.5 h-3.5" />
          <span>Datex MeliOps Platform</span>
        </div>

        <div className="max-w-md space-y-6">
          <h1 className="text-4xl font-extrabold tracking-tight leading-tight">
            A primeira visão <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-[#60a5fa]">consolidada</span> real do seu Mercado Livre.
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Esqueça alternar entre guias ou somar valores na planilha. O Datex conecta suas contas sob uma mesma organização e oferece inteligência de vendas unificada.
          </p>

          <div className="space-y-3.5 pt-4">
            <div className="flex items-center gap-3">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-primary">
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-semibold text-foreground/90">Sincronização Segura via API Oficial</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-primary">
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-semibold text-foreground/90">Visão Consolidada de Faturamento & Reputação</span>
            </div>
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Datex Technology. Todos os direitos reservados.
        </div>
      </div>
    </div>
  );
}
