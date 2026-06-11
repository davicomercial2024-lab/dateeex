import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MercadoLivreApiService } from "@/services/mercado-livre-api.service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("datex_session")?.value;
    if (!token) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const session = await verifyToken(token);
    if (!session) return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");

    // Define qual conta buscar
    let whereClause: any = { organizationId: session.orgId, isActive: true, status: "CONNECTED" };
    if (accountId && accountId !== "all") {
      whereClause.id = accountId;
    }

    const accounts = await prisma.mercadoLivreAccount.findMany({
      where: whereClause,
      include: { token: true },
    });

    if (accounts.length === 0) {
      return NextResponse.json({ success: true, listings: [] });
    }

    let allListings: any[] = [];

    for (const account of accounts) {
      if (!account.token) continue;
      
      const dbListings = await prisma.listing.findMany({
        where: { mercadoLivreAccountId: account.id },
        orderBy: { createdAt: 'desc' },
        take: 100 // limit to 100 for performance on multiget
      });

      if (dbListings.length === 0) continue;

      const itemIds = dbListings.map(l => l.mlItemId);
      const healthData = await MercadoLivreApiService.fetchItemsHealth(itemIds, account.token.accessToken);
      
      // Cria um mapa de health para acesso O(1)
      const healthMap = new Map();
      healthData.forEach(h => {
        healthMap.set(h.item_id, h);
      });

      for (const listing of dbListings) {
        const h = healthMap.get(listing.mlItemId);
        
        // Simulação básica de "Você recebe": descontar 15% (média de tarifa) 
        // e um custo fixo de R$6,00 (frete/custo fixo) para itens baratos.
        const priceNum = Number(listing.price);
        const tarifaMedia = priceNum * 0.15;
        const custoFixo = priceNum < 79 ? 6 : 0; 
        const youReceive = priceNum - tarifaMedia - custoFixo;

        allListings.push({
          id: listing.id,
          mlItemId: listing.mlItemId,
          title: listing.title,
          price: priceNum,
          currencyId: listing.currencyId,
          availableQuantity: listing.availableQuantity,
          soldQuantity: listing.soldQuantity,
          status: listing.status,
          permalink: listing.permalink,
          thumbnail: listing.thumbnail,
          accountId: account.id,
          accountName: account.nicknameCustom || account.nickname,
          youReceive: Math.max(youReceive, 0),
          quality: h?.health ? h.health * 100 : 80, // Default 80% if not found
          recommendations: h?.actions || [],
          visits7d: null,
          sales7d: null,
          condition: null,
          shipping: null,
        });
      }
    }

    return NextResponse.json({ success: true, listings: allListings });
  } catch (error: any) {
    console.error("Erro GET /api/listings/advanced:", error);
    return NextResponse.json({ error: "Erro interno ao carregar anúncios avançados." }, { status: 500 });
  }
}
