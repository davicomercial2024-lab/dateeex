"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck, Layers, User, Building, Mail, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !company.trim() || !email.trim() || !password.trim()) {
      setError("Por favor, preencha todos os campos obrigatórios.");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas informadas não coincidem.");
      return;
    }

    try {
      setIsLoading(true);
      setError("");
      
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, company, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erro ao criar conta.");
      }
      
      localStorage.setItem("datex_logged_in", "true");
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Erro ao criar conta. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-[#0B0F19] text-white">
      {/* Left side: Premium Marketing Graphic Panel (Hidden on Mobile) */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-[#121826] to-[#0A0D14] flex-col justify-between p-12 border-r border-[#1f293d] relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-0 left-0 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="flex items-center gap-1.5 text-xs text-primary font-bold uppercase tracking-widest bg-[#1a2333] border border-[#2b3a54] px-3 py-1.5 rounded-full w-fit">
          <Layers className="w-3.5 h-3.5" />
          <span>Cadastre sua Organização</span>
        </div>

        <div className="max-w-md space-y-6">
          <h1 className="text-4xl font-extrabold tracking-tight leading-tight">
            Pronto para unificar suas contas?
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Cadastre-se hoje e configure o Datex em menos de 5 minutos. Uma única conta pode gerenciar dezenas de lojas no Mercado Livre, isolando permissões de usuários por organização.
          </p>

          <div className="space-y-4 pt-4 border-t border-[#1f293d]">
            <div className="flex gap-3">
              <div className="p-1 rounded bg-[#1a2333] text-primary h-fit">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-semibold">Organizações Seguras</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Controle total de permissões de membros e administradores na mesma plataforma.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Datex Technology. Todos os direitos reservados.
        </div>
      </div>

      {/* Right side: Form */}
      <div className="flex-1 flex flex-col justify-center px-8 md:px-16 lg:px-24 py-12">
        <div className="w-full max-w-md mx-auto">
          {/* Logo */}
          <div className="flex items-center gap-2 mb-8">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary text-primary-foreground font-black text-xl shadow-md">
              D
            </div>
            <span className="font-extrabold text-2xl tracking-wider">Datex</span>
          </div>

          {/* Titles */}
          <h2 className="text-2xl font-bold tracking-tight mb-1">Crie sua conta</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Inicie a gestão profissional e integrada dos seus canais.
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> Seu Nome
              </label>
              <Input
                placeholder="Ex: João da Silva"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError("");
                }}
                disabled={isLoading}
                className="bg-[#121826] border-[#1f293d] focus-visible:ring-primary text-white"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5" /> Nome da Empresa / Organização
              </label>
              <Input
                placeholder="Ex: Minha Loja Ltda"
                value={company}
                onChange={(e) => {
                  setCompany(e.target.value);
                  setError("");
                }}
                disabled={isLoading}
                className="bg-[#121826] border-[#1f293d] focus-visible:ring-primary text-white"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" /> E-mail Comercial
              </label>
              <Input
                type="email"
                placeholder="joao@minhaempresa.com"
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

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" /> Senha de Acesso
              </label>
              <Input
                type="password"
                placeholder="Mínimo 8 caracteres"
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

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" /> Confirmar Senha
              </label>
              <Input
                type="password"
                placeholder="Confirme sua senha"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
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
              className="w-full font-semibold py-5 shadow-lg shadow-primary/20 bg-primary hover:bg-primary/95 text-white transition-all transform hover:scale-[1.01] mt-4"
            >
              {isLoading ? "Criando Organização..." : "Cadastrar e Entrar"}
            </Button>
          </form>

          {/* Login link */}
          <p className="text-center text-sm text-muted-foreground mt-6">
            Já tem conta no Datex?{" "}
            <Link href="/login" className="text-primary font-semibold hover:underline">
              Fazer Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
