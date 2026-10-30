"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { readVisitorId } from "@/lib/visitor";
import { normalisePhone } from "@/lib/format";

export type FormState = { ok?: boolean; error?: string };

const reviewSchema = z.object({
  businessId: z.uuid(),
  slug: z.string().min(1),
  name: z.string().trim().min(2, "Add your first name").max(40),
  rating: z.coerce.number().int().min(1, "Pick a rating").max(5),
  body: z.string().trim().max(600).optional(),
});

/** Reviews are only accepted from visitors who tapped WhatsApp or call on this listing. */
export async function submitReview(_: FormState, form: FormData): Promise<FormState> {
  const parsed = reviewSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  const { businessId, slug, name, rating, body } = parsed.data;

  const visitorId = await readVisitorId();
  if (!visitorId) return { error: "Only people who contacted this business through FindAm can review it." };

  const event = await queryOne<{ id: string }>(
    `SELECT e.id FROM contact_events e
     WHERE e.business_id = $1 AND e.visitor_id = $2 AND e.channel IN ('whatsapp','call')
       AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.contact_event_id = e.id)
       AND NOT EXISTS (SELECT 1 FROM reviews r JOIN contact_events e2 ON e2.id = r.contact_event_id
                       WHERE r.business_id = $1 AND e2.visitor_id = $2)
     ORDER BY e.created_at DESC LIMIT 1`,
    [businessId, visitorId],
  );
  if (!event) return { error: "Only people who contacted this business through FindAm can review it, once." };

  await query(
    `INSERT INTO reviews (business_id, reviewer_name, contact_event_id, rating, body)
     VALUES ($1, $2, $3, $4, $5)`,
    [businessId, name, event.id, rating, body || null],
  );
  revalidatePath(`/b/${slug}`);
  return { ok: true };
}

const reportSchema = z.object({
  businessId: z.uuid(),
  reason: z.enum(["closed", "moved", "wrong_contact", "scam", "other"]),
  note: z.string().trim().max(500).optional(),
});

export async function submitReport(_: FormState, form: FormData): Promise<FormState> {
  const parsed = reportSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Pick what's wrong" };
  const { businessId, reason, note } = parsed.data;
  await query("INSERT INTO reports (business_id, reason, note) VALUES ($1, $2, $3)", [
    businessId,
    reason,
    note || null,
  ]);
  return { ok: true };
}

const ownerSchema = z.object({
  businessId: z.uuid(),
  name: z.string().trim().max(60).optional(),
  phone: z.string().trim().min(1, "Add your phone number"),
  note: z.string().trim().max(500).optional(),
});

/**
 * "This is my business, take it down." Goes to the admin reports queue. The
 * team calls the number to confirm before removing, so nobody can take down
 * a competitor's listing.
 */
export async function requestRemoval(_: FormState, form: FormData): Promise<FormState> {
  const parsed = ownerSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  const phone = normalisePhone(parsed.data.phone);
  if (!phone) return { error: "That doesn't look like a Nigerian phone number" };
  await query(
    "INSERT INTO reports (business_id, reason, note, contact_phone) VALUES ($1, 'owner_removal', $2, $3)",
    [parsed.data.businessId, [parsed.data.name, parsed.data.note].filter(Boolean).join(" · ") || null, phone],
  );
  return { ok: true };
}

/**
 * Claim from the website, for owners who'd rather not use WhatsApp. A web form
 * can't prove the person owns the number, so these always go to the team to
 * check by phone. (Claims on WhatsApp from the listed number link instantly.)
 */
export async function requestClaim(_: FormState, form: FormData): Promise<FormState> {
  const parsed = ownerSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  const phone = normalisePhone(parsed.data.phone);
  if (!phone) return { error: "That doesn't look like a Nigerian phone number" };
  const b = await queryOne<{ owner_id: string | null }>("SELECT owner_id FROM businesses WHERE id = $1", [parsed.data.businessId]);
  if (!b) return { error: "Listing not found" };
  if (b.owner_id) return { error: "This listing has already been claimed. If that's wrong, use Report a problem." };
  await query(
    `INSERT INTO claim_requests (business_id, phone, name, note, channel) VALUES ($1, $2, $3, $4, 'web')
     ON CONFLICT (business_id, phone) WHERE status = 'pending' DO NOTHING`,
    [parsed.data.businessId, phone, parsed.data.name || null, parsed.data.note || null],
  );
  return { ok: true };
}
