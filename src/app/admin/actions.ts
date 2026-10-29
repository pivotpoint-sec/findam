"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { query } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { normalisePhone } from "@/lib/format";

// Every action re-checks the admin login: middleware guards the pages, but
// server actions are plain POSTs and must not rely on that alone.

const id = z.uuid();

export async function approveListing(form: FormData) {
  await requireAdmin();
  const bid = id.parse(form.get("id"));
  await query(
    "UPDATE businesses SET status = 'live', last_confirmed_at = coalesce(last_confirmed_at, now()) WHERE id = $1 AND status = 'pending'",
    [bid],
  );
  revalidatePath("/admin", "layout");
}

export async function rejectListing(form: FormData) {
  await requireAdmin();
  await query("UPDATE businesses SET status = 'rejected' WHERE id = $1", [id.parse(form.get("id"))]);
  revalidatePath("/admin", "layout");
}

export async function setListingStatus(form: FormData) {
  await requireAdmin();
  const status = z.enum(["live", "hidden", "closed"]).parse(form.get("status"));
  await query("UPDATE businesses SET status = $2 WHERE id = $1", [id.parse(form.get("id")), status]);
  revalidatePath("/admin", "layout");
}

/** An agent visited and saw the business open at the listed place. */
export async function markVisited(form: FormData) {
  await requireAdmin();
  const bid = id.parse(form.get("id"));
  await query(
    `UPDATE businesses SET verification_level = CASE WHEN verification_level = 'cac' THEN 'cac' ELSE 'visited' END,
       last_confirmed_at = now(), status = CASE WHEN status IN ('hidden','pending') THEN 'live' ELSE status END
     WHERE id = $1`,
    [bid],
  );
  await query("INSERT INTO verifications (business_id, method, evidence) VALUES ($1, 'visit', $2)", [
    bid,
    JSON.stringify({ note: String(form.get("note") ?? "") || null }),
  ]);
  await query("SELECT recompute_trust()");
  revalidatePath("/admin", "layout");
}

export async function resolveReport(form: FormData) {
  await requireAdmin();
  const rid = id.parse(form.get("id"));
  const outcome = z.enum(["dismiss", "close", "hide"]).parse(form.get("outcome"));
  const rows = await query<{ business_id: string }>(
    "UPDATE reports SET resolved = TRUE WHERE id = $1 RETURNING business_id",
    [rid],
  );
  const bid = rows[0]?.business_id;
  if (bid && outcome === "close") await query("UPDATE businesses SET status = 'closed' WHERE id = $1", [bid]);
  if (bid && outcome === "hide") await query("UPDATE businesses SET status = 'hidden' WHERE id = $1", [bid]);
  await query("SELECT recompute_trust()");
  revalidatePath("/admin", "layout");
}

const intOrNull = z.preprocess(
  (v) => (v === "" || v == null ? null : Number(String(v).replace(/[^\d]/g, ""))),
  z.number().int().nonnegative().nullable(),
);

const editSchema = z.object({
  id,
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(300),
  landmark_directions: z.string().trim().max(400),
  shop_number: z.string().trim().max(20),
  whatsapp: z.string().trim(),
  phone: z.string().trim(),
  hours_note: z.string().trim().max(80),
  price_min_ngn: intOrNull,
  price_max_ngn: intOrNull,
  category_id: z.coerce.number().int().positive(),
  area_id: z.coerce.number().int().positive(),
  market_section_id: intOrNull,
});

export async function updateListing(form: FormData) {
  await requireAdmin();
  const d = editSchema.parse(Object.fromEntries(form));
  const whatsapp = d.whatsapp ? normalisePhone(d.whatsapp) : null;
  const phone = d.phone ? normalisePhone(d.phone) : null;
  if (d.whatsapp && !whatsapp) throw new Error("Invalid WhatsApp number");
  if (d.phone && !phone) throw new Error("Invalid phone number");
  await query(
    `UPDATE businesses SET name = $2, description = nullif($3, ''), landmark_directions = nullif($4, ''),
       shop_number = nullif($5, ''), whatsapp = $6, phone = $7, hours_note = nullif($8, ''),
       price_min_ngn = $9, price_max_ngn = $10, category_id = $11, area_id = $12, market_section_id = $13
     WHERE id = $1`,
    [d.id, d.name, d.description, d.landmark_directions, d.shop_number, whatsapp, phone, d.hours_note,
     d.price_min_ngn, d.price_max_ngn, d.category_id, d.area_id, d.market_section_id],
  );
  revalidatePath("/admin", "layout");
  redirect(`/admin/listings?saved=${d.id}`);
}
