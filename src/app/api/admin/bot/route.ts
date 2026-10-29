import { NextResponse, type NextRequest } from "next/server";
import { checkBasicAuth } from "@/lib/auth";
import { normalisePhone } from "@/lib/format";
import { handleIncoming } from "@/lib/whatsapp/bot";

// Lets the team talk to the bot from /admin/bot without WhatsApp. Uses the
// real conversation logic and the real database, so a test chat creates real
// listings; use a test phone number and delete them afterwards.
export async function POST(req: NextRequest) {
  if (!checkBasicAuth(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }
  const body = (await req.json()) as { from?: string; text?: string; buttonId?: string; lat?: number; lng?: number };
  const from = normalisePhone(body.from);
  if (!from) return NextResponse.json({ error: "Use a Nigerian phone number" }, { status: 400 });

  const replies = await handleIncoming({
    from,
    text: body.text,
    buttonId: body.buttonId,
    location: body.lat != null && body.lng != null ? { lat: body.lat, lng: body.lng } : undefined,
  });
  return NextResponse.json({ replies });
}
