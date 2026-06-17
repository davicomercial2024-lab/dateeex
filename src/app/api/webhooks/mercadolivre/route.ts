import { after, NextResponse } from "next/server";
import { pbAdmin } from "@/lib/pb";
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

  let rawPayload: Record<string, unknown> = {};

  try {
    const text = await request.text();
    if (text) {
      rawPayload = JSON.parse(text);
    }
  } catch {
    rawPayload = { _parse_error: "Body não é JSON válido" };
  }

  const topic = String(rawPayload.topic || rawPayload.type || "unknown");
  const resource = String(rawPayload.resource || "");
  const userIdMercadoLivre = rawPayload.user_id
    ? String(rawPayload.user_id)
    : null;
  const applicationId = rawPayload.application_id
    ? String(rawPayload.application_id)
    : null;
  const attempts = Number(rawPayload.attempts || 1);

  let webhookEventId: string | null = null;

  try {
    await pbAdmin.admins.authWithPassword(process.env.PB_ADMIN_EMAIL || 'bbbaterias@bbdi.com.br', process.env.PB_ADMIN_PASS || 'diev1pn4753ikpf');
    const saved = await pbAdmin.collection("webhook_events").create({
      provider: "mercadolivre",
      topic,
      resource,
      userIdMercadoLivre,
      applicationId,
      attempts,
      payload: rawPayload,
      status: "received",
    });
    webhookEventId = saved.id;
  } catch (dbErr: any) {
    console.error("[Webhook ML] Falha crítica ao salvar evento no banco:", dbErr?.response || dbErr);
    return NextResponse.json({ ok: true }, { status: 200 });
  }

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

  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function GET() {
  return NextResponse.json(
    { ok: true, service: "Datex Webhook Receiver", provider: "mercadolivre" },
    { status: 200 }
  );
}
