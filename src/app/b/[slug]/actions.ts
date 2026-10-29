"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { readVisitorId } from "@/lib/visitor";

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
