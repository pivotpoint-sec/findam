import { NextResponse, type NextRequest } from "next/server";
import { queryOne, query } from "@/lib/db";
import { ensureVisitorId } from "@/lib/visitor";
import { whatsappLink } from "@/lib/format";

// Every WhatsApp, call or directions tap goes through here: we record a
// contact event (for owner stats and review eligibility), then redirect.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const channel = req.nextUrl.searchParams.get("channel");
  if (channel !== "whatsapp" && channel !== "call" && channel !== "directions") {
    return NextResponse.json({ error: "Unknown channel" }, { status: 400 });
  }
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const b = await queryOne<{ name: string; whatsapp: string | null; phone: string | null; lat: number | null; lng: number | null }>(
    `SELECT name, whatsapp, phone, ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng
     FROM businesses WHERE id = $1 AND status IN ('live','hidden')`,
    [id],
  );
  if (!b) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let target: string | null = null;
  if (channel === "whatsapp" && b.whatsapp) {
    target = whatsappLink(b.whatsapp, `Hello ${b.name}, I found you on FindAm.`);
  } else if (channel === "call" && (b.phone || b.whatsapp)) {
    target = `tel:${b.phone || b.whatsapp}`;
  } else if (channel === "directions" && b.lat != null && b.lng != null) {
    target = `https://www.google.com/maps/dir/?api=1&destination=${b.lat},${b.lng}`;
  }
  if (!target) return NextResponse.json({ error: "No contact for this channel" }, { status: 404 });

  const visitorId = await ensureVisitorId();
  await query(
    "INSERT INTO contact_events (business_id, visitor_id, channel) VALUES ($1, $2, $3)",
    [id, visitorId, channel],
  );

  return NextResponse.redirect(target, { status: 302 });
}
