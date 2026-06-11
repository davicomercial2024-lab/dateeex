import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = { params: Promise<{ id: string }> };

// ── PATCH /api/mercado-livre/accounts/[id] ───────────────────────────────────
// Edita nicknameCustom ou marca como padrão
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("datex_session");
    if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    const payload = await verifyToken(session.value);
    if (!payload) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });

    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    // Verifica se a conta pertence à org
    const account = await prisma.mercadoLivreAccount.findFirst({
      where: { id, organizationId: payload.orgId, isActive: true },
    });
    if (!account) return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });

    const updateData: Record<string, unknown> = {};

    // Editar apelido interno
    if (typeof body.nicknameCustom === "string") {
      const trimmed = body.nicknameCustom.trim();
      updateData.nicknameCustom = trimmed === "" ? null : trimmed;
    }

    // Definir como padrão
    if (body.isDefault === true) {
      // Remove o padrão de todas as outras contas da org
      await prisma.mercadoLivreAccount.updateMany({
        where: { organizationId: payload.orgId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
      updateData.isDefault = true;
    } else if (body.isDefault === false) {
      updateData.isDefault = false;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "Nenhum campo válido para atualizar." }, { status: 400 });
    }

    const updated = await prisma.mercadoLivreAccount.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        nickname: true,
        nicknameCustom: true,
        isDefault: true,
        status: true,
      },
    });

    return NextResponse.json({
      success: true,
      account: { ...updated, displayName: updated.nicknameCustom || updated.nickname },
    });
  } catch (err: any) {
    console.error("PATCH /api/mercado-livre/accounts/[id] error:", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

// ── DELETE /api/mercado-livre/accounts/[id] ──────────────────────────────────
// Soft delete — marca isActive=false, status=DISCONNECTED, expira o token
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("datex_session");
    if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    const payload = await verifyToken(session.value);
    if (!payload) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });

    const { id } = await params;

    const account = await prisma.mercadoLivreAccount.findFirst({
      where: { id, organizationId: payload.orgId },
      include: { token: true },
    });
    if (!account) return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      // Soft delete da conta
      await tx.mercadoLivreAccount.update({
        where: { id },
        data: {
          isActive: false,
          status: "DISCONNECTED",
          isDefault: false,
          disconnectedAt: new Date(),
          lastSyncStatus: null,
        },
      });

      // Expira o token imediatamente (impede sincronizações futuras)
      if (account.token) {
        await tx.oAuthToken.update({
          where: { mercadoLivreAccountId: id },
          data: { expiresAt: new Date() }, // expira agora
        });
      }

      // Audit log
      const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
      await tx.auditLog.create({
        data: {
          organizationId: payload.orgId,
          userId: payload.userId,
          mercadoLivreAccountId: id,
          action: "DISCONNECT_ACCOUNT",
          details: `Conta '${account.nickname}' (meliUserId: ${account.meliUserId}) desconectada. Dados históricos mantidos.`,
          ipAddress: ip,
        },
      });
    });

    return NextResponse.json({ success: true, message: "Conta desconectada com sucesso. Dados históricos mantidos." });
  } catch (err: any) {
    console.error("DELETE /api/mercado-livre/accounts/[id] error:", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
