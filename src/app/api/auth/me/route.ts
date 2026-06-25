import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { pbAdmin } from "@/lib/pb";
import { verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("datex_session");

    if (!sessionCookie) {
      return NextResponse.json({ error: "Sessão não encontrada." }, { 
        status: 401,
        headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" }
      });
    }

    // Valida o token customizado
    const payload = await verifyToken(sessionCookie.value);

    if (!payload) {
      return NextResponse.json({ error: "Sessão inválida ou expirada." }, { 
        status: 401,
        headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" }
      });
    }

    // Autentica admin para queries
    await pbAdmin.admins.authWithPassword(process.env.PB_ADMIN_EMAIL as string, process.env.PB_ADMIN_PASS as string);

    // Busca usuário no PocketBase
    let user;
    try {
      user = await pbAdmin.collection("users").getOne(payload.userId as string);
    } catch (e) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    }

    // Busca o vínculo na organização atual
    let activeMembership;
    try {
      activeMembership = await pbAdmin.collection("organization_members").getFirstListItem(
        `user="${payload.userId}" && organization="${payload.orgId}"`,
        { expand: "organization" }
      );
    } catch (e) {
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
        id: activeMembership.expand?.organization?.id,
        name: activeMembership.expand?.organization?.name,
      },
    }, {
      headers: {
        "Cache-Control": "no-store, max-age=0, must-revalidate",
        "Pragma": "no-cache"
      }
    });
  } catch (error) {
    console.error("API Me Error:", error);
    return NextResponse.json(
      { error: "Erro interno no servidor." },
      { status: 500 }
    );
  }
}
