import { pool, queryOne } from "./db";
import { uniqueSlug } from "./businesses";
import { slugify } from "./format";

export type NewBusiness = {
  name: string;
  categoryId: number;
  areaId: number;
  marketSectionId?: number | null;
  shopNumber?: string | null;
  description?: string | null;
  landmarkDirections?: string | null;
  lat?: number | null;
  lng?: number | null;
  whatsapp?: string | null;
  phone?: string | null;
  priceMin?: number | null;
  priceMax?: number | null;
  comesToYou?: boolean;
  serviceAreaIds?: number[];
  hoursNote?: string | null;
  photos?: { url: string; kind: "entrance" | "shopfront" | "work" }[];
  ownerPhone?: string | null;   // links the listing to an owner account
};

export type CreateMode =
  | { source: "web" }                               // public form: pending review
  | { source: "bot" }                               // owner on WhatsApp: live, number confirmed
  | { source: "agent"; agentNote?: string | null }; // field agent visit: live, verified

/** Creates a business with its photos in one transaction. Returns id and slug. */
export async function createBusiness(b: NewBusiness, mode: CreateMode) {
  const slug = await uniqueSlug(slugify(b.name));
  const status = mode.source === "web" ? "pending" : "live";
  const verification = mode.source === "agent" ? "visited" : mode.source === "bot" ? "phone" : "none";
  const confirmed = mode.source === "web" ? null : new Date();

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let ownerId: string | null = null;
    if (b.ownerPhone) {
      const u = await client.query<{ id: string }>(
        `INSERT INTO users (phone, role) VALUES ($1, 'owner')
         ON CONFLICT (phone) DO UPDATE SET role = CASE WHEN users.role = 'user' THEN 'owner' ELSE users.role END
         RETURNING id`,
        [b.ownerPhone],
      );
      ownerId = u.rows[0].id;
    }

    const res = await client.query<{ id: string }>(
      `INSERT INTO businesses (name, slug, category_id, area_id, market_section_id, shop_number, description,
         landmark_directions, location, whatsapp, phone, price_min_ngn, price_max_ngn, comes_to_you,
         service_area_ids, hours_note, verification_level, last_confirmed_at, status, source, owner_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
         CASE WHEN $9::float IS NULL OR $10::float IS NULL THEN NULL ELSE ST_MakePoint($10, $9)::geography END,
         $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
       RETURNING id`,
      [
        b.name.trim(), slug, b.categoryId, b.areaId, b.marketSectionId ?? null, b.shopNumber || null,
        b.description || null, b.landmarkDirections || null, b.lat ?? null, b.lng ?? null,
        b.whatsapp || null, b.phone || null, b.priceMin ?? null, b.priceMax ?? null, !!b.comesToYou,
        b.serviceAreaIds ?? [], b.hoursNote || null, verification, confirmed, status, mode.source, ownerId,
      ],
    );
    const id = res.rows[0].id;

    for (const [i, p] of (b.photos ?? []).entries()) {
      await client.query(
        "INSERT INTO business_photos (business_id, kind, url, sort_order) VALUES ($1, $2, $3, $4)",
        [id, p.kind, p.url, i],
      );
    }

    if (mode.source === "agent") {
      await client.query(
        "INSERT INTO verifications (business_id, method, evidence) VALUES ($1, 'visit', $2)",
        [id, JSON.stringify({ lat: b.lat ?? null, lng: b.lng ?? null, note: mode.agentNote ?? null, photos: (b.photos ?? []).map((p) => p.url) })],
      );
    } else if (mode.source === "bot") {
      await client.query("INSERT INTO verifications (business_id, method) VALUES ($1, 'phone')", [id]);
    }

    await client.query("COMMIT");
    return { id, slug, status };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** Is there already a live or pending listing on this WhatsApp number? */
export async function findByWhatsapp(phone: string) {
  return queryOne<{ id: string; name: string; slug: string; owner_id: string | null; status: string }>(
    `SELECT id, name, slug, owner_id, status FROM businesses
     WHERE whatsapp = $1 AND status IN ('live','hidden','pending')
     ORDER BY created_at LIMIT 1`,
    [phone],
  );
}
