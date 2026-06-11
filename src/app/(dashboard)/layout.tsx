"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { MeliProvider } from "@/context/meli-context";
import { ThemeProvider } from "@/components/theme-provider";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<{ name: string; email: string; role: string } | null>(null);
  const [organization, setOrganization] = useState<{ id: string; name: string } | null>(null);
  const router = useRouter();

  // Guard for real session authentication by fetching user details from /api/auth/me
  useEffect(() => {
    let active = true;

    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) {
          throw new Error("Sessão inválida ou expirada.");
        }
        const data = await res.json();
        if (data && data.success) {
          if (active) {
            setUser(data.user);
            setOrganization(data.organization);
            setIsAuthenticated(true);
            localStorage.setItem("datex_logged_in", "true");
          }
        } else {
          throw new Error("Erro na sessão.");
        }
      } catch (err) {
        if (active) {
          localStorage.removeItem("datex_logged_in");
          router.push("/login");
        }
      }
    }

    checkAuth();

    return () => {
      active = false;
    };
  }, [router]);

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#0B0F19]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm font-semibold text-white uppercase tracking-wider">
            Carregando Datex...
          </p>
        </div>
      </div>
    );
  }

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <MeliProvider>
        <div className="min-h-screen bg-background text-foreground transition-colors duration-200">
          {/* Responsive Sidebar */}
          <Sidebar
            isOpenMobile={isMobileSidebarOpen}
            onCloseMobile={() => setIsMobileSidebarOpen(false)}
          />

          {/* Main Content Area */}
          <div className="md:pl-64 flex flex-col min-h-screen">
            {/* Topbar */}
            <Topbar
              user={user}
              organization={organization}
              onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
            />

            {/* Inner Dashboard View */}
            <main className="flex-1 p-6 md:p-8 max-w-[1400px] w-full mx-auto">
              {children}
            </main>
          </div>
        </div>
      </MeliProvider>
    </ThemeProvider>
  );
}
