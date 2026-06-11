import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MercadoLivreApiService } from "@/services/mercado-livre-api.service";

type ApplyMode = "apply" | "remove";

interface PromotionActionItem {
  itemId: string;
  originalPrice?: number;
}

interface PromotionActionPayload {
  accountId: string;
  mode: ApplyMode;
  campaign: {
    id: string;
    type: string;
    name?: string;
  };
  config?: {
    dealPrice?: number;
    discountPercent?: number;
    quantity?: number;
  };
  items: PromotionActionItem[];
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeType(type: string) {
  return type.toUpperCase();
}

function buildPayloadForItem(
  campaignType: string,
  item: PromotionActionItem,
  config?: PromotionActionPayload["config"]
) {
  const type = normalizeType(campaignType);

  switch (type) {
    case "DEAL":
    case "LIGHTNING":
    case "DOD": {
      const dealPrice =
        config?.dealPrice ??
        (isFiniteNumber(config?.discountPercent) && isFiniteNumber(item.originalPrice)
          ? Number((item.originalPrice * (1 - config.discountPercent / 100)).toFixed(2))
          : undefined);

      if (!isFiniteNumber(dealPrice) || dealPrice <= 0) {
        throw new Error("Campanhas de preço exigem um preço promocional válido.");
      }

      return { dealPrice };
    }
    case "VOLUME": {
      if (!isFiniteNumber(config?.discountPercent) || config.discountPercent <= 0) {
        throw new Error("Promoções por volume exigem percentual de desconto.");
      }

      if (!isFiniteNumber(config?.quantity) || config.quantity < 2) {
        throw new Error("Promoções por volume exigem quantidade mínima maior ou igual a 2.");
      }

      return {
        discountPercent: config.discountPercent,
        quantity: config.quantity,
      };
    }
    case "PRICE_DISCOUNT": {
      const payload: { dealPrice?: number; discountPercent?: number } = {};

      if (isFiniteNumber(config?.dealPrice) && config.dealPrice > 0) {
        payload.dealPrice = config.dealPrice;
      }

      if (isFiniteNumber(config?.discountPercent) && config.discountPercent > 0) {
        payload.discountPercent = config.discountPercent;
      }

      if (!payload.dealPrice && !payload.discountPercent && isFiniteNumber(item.originalPrice)) {
        throw new Error("Descontos individuais exigem preço final ou percentual.");
      }

      return payload;
    }
    default:
      return {
        dealPrice: isFiniteNumber(config?.dealPrice) ? config.dealPrice : undefined,
        discountPercent: isFiniteNumber(config?.discountPercent)
          ? config.discountPercent
          : undefined,
        quantity: isFiniteNumber(config?.quantity) ? config.quantity : undefined,
      };
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("datex_session")?.value;

    if (!token) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const session = await verifyToken(token);

    if (!session) {
      return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
    }

    const body = (await request.json()) as PromotionActionPayload;

    if (
      !body?.accountId ||
      !body?.mode ||
      !body?.campaign?.id ||
      !body?.campaign?.type ||
      !Array.isArray(body.items) ||
      body.items.length === 0
    ) {
      return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
    }

    const account = await prisma.mercadoLivreAccount.findFirst({
      where: {
        id: body.accountId,
        organizationId: session.orgId,
        isActive: true,
      },
      include: { token: true },
    });

    if (!account?.token) {
      return NextResponse.json({ error: "Conta não encontrada ou sem token." }, { status: 404 });
    }

    const accessToken = account.token.accessToken;
    const results: Array<{ itemId: string; success: boolean; error?: string }> = [];

    for (const item of body.items) {
      try {
        if (!item.itemId) {
          throw new Error("Item sem identificador.");
        }

        if (body.mode === "remove") {
          await MercadoLivreApiService.deletePromotion(
            item.itemId,
            body.campaign.id,
            body.campaign.type,
            accessToken
          );
        } else {
          const payload = buildPayloadForItem(body.campaign.type, item, body.config);

          await MercadoLivreApiService.applyPromotion(
            item.itemId,
            body.campaign.id,
            body.campaign.type,
            payload,
            accessToken
          );
        }

        results.push({ itemId: item.itemId, success: true });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Erro ao processar item.";
        results.push({ itemId: item.itemId, success: false, error: message });
      }
    }

    const successCount = results.filter((result) => result.success).length;
    const errorCount = results.length - successCount;

    return NextResponse.json({
      success: true,
      summary: {
        total: results.length,
        successCount,
        errorCount,
        mode: body.mode,
        campaignId: body.campaign.id,
        campaignType: normalizeType(body.campaign.type),
      },
      results,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro interno.";
    console.error("POST /api/promotions/apply error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
