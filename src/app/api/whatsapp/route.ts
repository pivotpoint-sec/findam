import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { query } from "@/lib/db";
import { normalisePhone } from "@/lib/format";
import { savePhoto } from "@/lib/storage";
import { downloadMedia, send } from "@/lib/whatsapp/client";
import { handleIncoming, type Incoming } from "@/lib/whatsapp/bot";

// WhatsApp Cloud API webhook.
// GET: Meta's one-time verification. POST: incoming messages.

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  if (p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(p.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

type WaMessage = {
  id: string;
  from: string;
  type: string;
  text?: { body: string };
  interactive?: { button_reply?: { id: string; title: string }; list_reply?: { id: string; title: string } };
  button?: { text: string; payload?: string };   // template quick-reply
  location?: { latitude: number; longitude: number };
  image?: { id: string; mime_type: string };
};

export async function POST(req: NextRequest) {
  const raw = await req.text();

  if (!validSignature(raw, req.headers.get("x-hub-signature-256"))) {
    return new Response("Bad signature", { status: 401 });
  }

  let body: { entry?: { changes?: { value?: { messages?: WaMessage[] } }[] }[] };
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  const messages = body.entry?.flatMap((e) => e.changes?.flatMap((c) => c.value?.messages ?? []) ?? []) ?? [];

  for (const m of messages) {
    // Meta retries deliveries; answer each message once.
    const fresh = await query("INSERT INTO bot_messages_seen (id) VALUES ($1) ON CONFLICT DO NOTHING RETURNING id", [m.id]);
    if (fresh.length === 0) continue;

    const from = normalisePhone(m.from);
    if (!from) continue; // the bot is for Nigerian numbers only

    try {
      const incoming = await toIncoming(from, m);
      const replies = await handleIncoming(incoming);
      for (const r of replies) await send(from, r);
    } catch (err) {
      console.error("whatsapp bot error", err);
      await send(from, { type: "text", body: "Sorry, something went wrong on our side. Please try again in a minute." }).catch(() => {});
    }
  }

  // Always 200 quickly, or Meta keeps retrying.
  return NextResponse.json({ ok: true });
}

async function toIncoming(from: string, m: WaMessage): Promise<Incoming> {
  const msg: Incoming = { from };
  if (m.type === "text") msg.text = m.text?.body;
  if (m.type === "interactive") {
    const reply = m.interactive?.button_reply ?? m.interactive?.list_reply;
    msg.buttonId = reply?.id;
    msg.text = reply?.title;
  }
  if (m.type === "button") {
    // Quick-reply buttons on the weekly check template.
    const t = (m.button?.payload || m.button?.text || "").toLowerCase();
    msg.buttonId = t.includes("moved") ? "ping_moved" : t.includes("same") || t.includes("yes") ? "ping_yes" : undefined;
    msg.text = m.button?.text;
  }
  if (m.type === "location" && m.location) {
    msg.location = { lat: m.location.latitude, lng: m.location.longitude };
  }
  if (m.type === "image" && m.image) {
    msg.hasImage = true;
    const media = await downloadMedia(m.image.id).catch(() => null);
    if (media) msg.photoUrl = await savePhoto(media.data, media.mime).catch(() => null);
  }
  return msg;
}

function validSignature(raw: string, header: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) {
    // Without a secret we can't check; only acceptable in development.
    return process.env.NODE_ENV !== "production";
  }
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(header.slice(7));
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
