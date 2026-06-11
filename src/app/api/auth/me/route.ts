import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("datex_session");

    if (!sessionCookie) {
      return NextResponse.json({ error: "Sessão não encontrada." }, { status: 401 });
    }

    // Valida o token
    const payload = await verifyToken(sessionCookie.value);

    if (!payload) {
      return NextResponse.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
    }

    // Busca usuário no banco com o membro e a organização correspondente
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: {
        memberships: {
          where: { organizationId: payload.orgId },
          include: {
            organization: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    }

    const activeMembership = user.memberships[0];

    if (!activeMembership) {
      return NextResponse.json(
        { error: "Vínculo de organização não encontrado." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: activeMembership.role,
      },
      organization: {
        id: activeMembership.organization.id,
        name: activeMembership.organization.name,
      },
    });
  } catch (error) {
    console.error("API Me Error:", error);
    return NextResponse.json(
      { error: "Erro interno no servidor." },
      { status: 500 }
    );
  }
}
