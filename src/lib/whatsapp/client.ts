// Thin client for the WhatsApp Cloud API (Meta Graph API).
// Without WHATSAPP_TOKEN it runs in dev mode: messages are logged and kept in
// memory instead of being sent, so the bot can be tested in /admin/bot.

const GRAPH = "https://graph.facebook.com/v21.0";

export type Outgoing =
  | { type: "text"; body: string }
  | { type: "buttons"; body: string; buttons: { id: string; title: string }[] };

export function isLive() {
  return !!process.env.WHATSAPP_TOKEN && !!process.env.WHATSAPP_PHONE_NUMBER_ID;
}

async function post(payload: Record<string, unknown>) {
  const res = await fetch(`${GRAPH}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WhatsApp send failed (${res.status}): ${text.slice(0, 300)}`);
  }
}

/** Phone in E.164 -> the digits-only form the API wants. */
const to = (e164: string) => e164.replace(/\D/g, "");

export async function send(phone: string, msg: Outgoing) {
  if (!isLive()) {
    console.log(`[whatsapp dev] to ${phone}:`, msg.type === "text" ? msg.body : `${msg.body} [${msg.buttons.map((b) => b.title).join(" | ")}]`);
    return;
  }
  if (msg.type === "text") {
    await post({ to: to(phone), type: "text", text: { body: msg.body, preview_url: true } });
  } else {
    await post({
      to: to(phone),
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: msg.body },
        action: {
          // WhatsApp allows up to 3 reply buttons, titles up to 20 characters.
          buttons: msg.buttons.slice(0, 3).map((b) => ({ type: "reply", reply: { id: b.id, title: b.title.slice(0, 20) } })),
        },
      },
    });
  }
}

/**
 * Business-initiated messages (outside the 24-hour reply window) must use an
 * approved template. Used for the weekly "still there?" check.
 */
export async function sendTemplate(phone: string, name: string, bodyParams: string[]) {
  if (!isLive()) {
    console.log(`[whatsapp dev] template "${name}" to ${phone}:`, bodyParams.join(" | "));
    return;
  }
  await post({
    to: to(phone),
    type: "template",
    template: {
      name,
      language: { code: process.env.WHATSAPP_TEMPLATE_LANG || "en" },
      components: bodyParams.length
        ? [{ type: "body", parameters: bodyParams.map((text) => ({ type: "text", text })) }]
        : [],
    },
  });
}

/** Downloads a photo the owner sent. Returns null in dev mode or on failure. */
export async function downloadMedia(mediaId: string): Promise<{ data: ArrayBuffer; mime: string } | null> {
  if (!isLive()) return null;
  const auth = { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` };
  const meta = await fetch(`${GRAPH}/${mediaId}`, { headers: auth });
  if (!meta.ok) return null;
  const { url, mime_type } = (await meta.json()) as { url: string; mime_type: string };
  const file = await fetch(url, { headers: auth });
  if (!file.ok) return null;
  return { data: await file.arrayBuffer(), mime: mime_type.split(";")[0] };
}
