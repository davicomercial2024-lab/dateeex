"use client";

import React, { useState, useEffect } from "react";
import { Users, Plus, Pencil, Trash2, Shield, User, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";

interface AppUser {
  id: string;
  role: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    createdAt: string;
  };
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "MEMBER",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<AppUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Falha ao carregar usuários.");
      const json = await res.json();
      if (json.success) setUsers(json.data);
      else throw new Error(json.error || "Erro ao buscar usuários");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const openNewUserModal = () => {
    setEditingUser(null);
    setFormData({ name: "", email: "", password: "", role: "MEMBER" });
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditUserModal = (user: AppUser) => {
    setEditingUser(user);
    setFormData({
      name: user.user.name || "",
      email: user.user.email,
      password: "", // leave empty
      role: user.role,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const openDeleteModal = (user: AppUser) => {
    setUserToDelete(user);
    setIsDeleteModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    const isEditing = !!editingUser;
    const url = isEditing ? `/api/admin/users/${editingUser.user.id}` : "/api/admin/users";
    const method = isEditing ? "PUT" : "POST";

    const payload = { ...formData };
    if (isEditing && !payload.password) delete (payload as any).password;

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Erro ao salvar usuário");
      }
      setIsModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/users/${userToDelete.user.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Erro ao excluir usuário");
      }
      setIsDeleteModalOpen(false);
      setUserToDelete(null);
      fetchUsers();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-5">
        <div className="space-y-1">
          <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-foreground/90 flex items-center gap-3">
            <Users className="w-6 h-6 text-primary" />
            Gestão de Usuários
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground font-medium">
            Gerencie os acessos e permissões da sua organização.
          </p>
        </div>
        <Button onClick={openNewUserModal} className="rounded-xl text-xs font-bold gap-2">
          <Plus className="w-4 h-4" />
          Novo Usuário
        </Button>
      </div>

      {error && (
        <div className="p-4 rounded-2xl border border-destructive/30 bg-destructive/5 text-destructive text-xs font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
          <button onClick={fetchUsers} className="ml-auto underline cursor-pointer">
            Tentar novamente
          </button>
        </div>
      )}

      <Card className="border-border/60 bg-card/60 backdrop-blur-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border/40">
              <tr>
                <th className="px-6 py-4 font-semibold">Usuário</th>
                <th className="px-6 py-4 font-semibold">Papel (Role)</th>
                <th className="px-6 py-4 font-semibold">Data de Criação</th>
                <th className="px-6 py-4 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Carregando usuários...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              ) : (
                users.map((member) => (
                  <tr key={member.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                          {member.user.name?.charAt(0).toUpperCase() || member.user.email.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{member.user.name || "Sem Nome"}</p>
                          <p className="text-xs text-muted-foreground">{member.user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${member.role === "ADMIN" ? "bg-indigo-500/10 text-indigo-500 border-indigo-500/20" : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"}`}>
                        {member.role === "ADMIN" ? <Shield className="w-3 h-3" /> : <User className="w-3 h-3" />}
                        {member.role}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {new Date(member.user.createdAt).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditUserModal(member)}
                          className="p-2 text-muted-foreground hover:text-primary transition-colors cursor-pointer rounded-lg hover:bg-primary/10"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openDeleteModal(member)}
                          className="p-2 text-muted-foreground hover:text-destructive transition-colors cursor-pointer rounded-lg hover:bg-destructive/10"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingUser ? "Editar Usuário" : "Novo Usuário"}
        description={editingUser ? "Atualize os dados ou permissões do usuário." : "Preencha os dados para adicionar um novo acesso."}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 text-xs font-semibold text-destructive bg-destructive/10 rounded-lg border border-destructive/20">
              {formError}
            </div>
          )}
          
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase">Nome</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Nome completo do usuário"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase">E-mail</label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="email@empresa.com"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase">
              Senha {editingUser && <span className="lowercase normal-case font-medium">(deixe em branco para manter a atual)</span>}
            </label>
            <Input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="Min. 6 caracteres"
              required={!editingUser}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase">Nível de Acesso</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="ADMIN">Administrador</option>
              <option value="MEMBER">Membro Padrão</option>
              <option value="VIEWER">Visualizador</option>
            </select>
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {editingUser ? "Salvar Alterações" : "Criar Usuário"}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Excluir Usuário"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Tem certeza que deseja excluir o usuário <strong className="text-foreground">{userToDelete?.user.name}</strong>? 
            Esta ação removerá o acesso desta conta à sua organização de forma irreversível.
          </p>
          <div className="pt-4 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setIsDeleteModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Sim, Excluir Usuário
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
