import { after, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { WebhookProcessorService } from "@/services/webhook-processor.service";

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;

  let result = 0;
  for (let i = 0; i < left.length; i++) {
    result |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }

  return result === 0;
}

function getIncomingSecret(request: Request) {
  const { searchParams } = new URL(request.url);

  return (
    request.headers.get("x-datex-webhook-secret") ||
    request.headers.get("x-webhook-secret") ||
    request.headers.get("x-mercadolivre-secret") ||
    searchParams.get("secret") ||
    ""
  );
}

/**
 * POST /api/webhooks/mercadolivre
 *
 * Receptor oficial de notificações (webhooks) do Mercado Livre.
 *
 * Contrato de resposta:
 *  - Eventos autenticados retornam HTTP 200 para evitar reenvio infinito pelo ML.
 *  - Requisições sem segredo válido retornam 401.
 *  - Salva o evento bruto no banco ANTES de qualquer processamento.
 *  - Agenda o processamento pesado no ciclo after() do Next,
 *    sem bloquear a resposta HTTP.
 *
 * Payload típico enviado pelo Mercado Livre:
 * {
 *   "_id": "...",
 *   "topic": "orders_v2",
 *   "resource": "/orders/2000123456789",
 *   "user_id": 123456789,
 *   "application_id": 123456789,
 *   "sent": "2024-01-15T10:30:00.000Z",
 *   "attempts": 1,
 *   "received": "2024-01-15T10:30:00.100Z"
 * }
 */
export async function POST(request: Request) {
  const expectedSecret = process.env.MERCADO_LIVRE_WEBHOOK_SECRET;

  if (!expectedSecret || expectedSecret === "seu_webhook_secret") {
    console.error("[Webhook ML] MERCADO_LIVRE_WEBHOOK_SECRET não configurado.");
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const incomingSecret = getIncomingSecret(request);
  if (!incomingSecret || !safeEqual(incomingSecret, expectedSecret)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // ── 1. Lê body bruto — nunca lança erro para o ML ─────────────────────────
  let rawPayload: Record<string, unknown> = {};

  try {
    const text = await request.text();
    if (text) {
      rawPayload = JSON.parse(text);
    }
  } catch {
    // Body malformado: registra como está e continua
    rawPayload = { _parse_error: "Body não é JSON válido" };
  }

  // ── 2. Extrai campos do payload do Mercado Livre ───────────────────────────
  const topic = String(rawPayload.topic || rawPayload.type || "unknown");
  const resource = String(rawPayload.resource || "");
  const userIdMercadoLivre = rawPayload.user_id
    ? String(rawPayload.user_id)
    : null;
  const applicationId = rawPayload.application_id
    ? String(rawPayload.application_id)
    : null;
  const attempts = Number(rawPayload.attempts || 1);

  // ── 3. Persiste o evento bruto no banco de dados ───────────────────────────
  // Feito ANTES do processamento para garantir rastreabilidade mesmo em falhas.
  let webhookEventId: string | null = null;

  try {
    const saved = await prisma.webhookEvent.create({
      data: {
        provider: "mercadolivre",
        topic,
        resource,
        userIdMercadoLivre,
        applicationId,
        attempts,
        payload: rawPayload as any,
        status: "received",
      },
    });
    webhookEventId = saved.id;
  } catch (dbErr: any) {
    // Se falhar ao salvar (problema de conexão com BD), loga e retorna 200
    // para não gerar reenvio infinito do Mercado Livre.
    console.error("[Webhook ML] Falha crítica ao salvar evento no banco:", dbErr?.message);
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // ── 4. Processa de forma assíncrona com after() ───────────────────────────
  // A resposta HTTP 200 é enviada imediatamente, e o Next mantém o trabalho
  // agendado no ciclo da requisição.
  const savedWebhookEventId = webhookEventId;

  if (savedWebhookEventId) {
    after(async () => {
      try {
        await WebhookProcessorService.process(savedWebhookEventId);
      } catch (err: any) {
        console.error(
          `[Webhook ML] Erro no processamento assíncrono do evento ${savedWebhookEventId}:`,
          err?.message || err
        );
      }
    });
  }

  // ── 5. Retorna 200 imediatamente ─────────────────────────────────────────
  return NextResponse.json({ ok: true }, { status: 200 });
}

/**
 * GET /api/webhooks/mercadolivre
 *
 * Alguns sistemas fazem um health-check GET antes de registrar a URL.
 * Retorna 200 com confirmação para não gerar 405 Method Not Allowed.
 */
export async function GET() {
  return NextResponse.json(
    { ok: true, service: "Datex Webhook Receiver", provider: "mercadolivre" },
    { status: 200 }
  );
}
