// Turns OpenStreetMap points of interest into unverified FindAm listings.
//
// OpenStreetMap data is © OpenStreetMap contributors, licensed under the Open
// Database Licence (ODbL). FindAm keeps imported rows separate (source_name =
// 'OpenStreetMap') and credits OSM wherever they are shown. If you ever share
// or sell the imported data itself, it must stay under the ODbL.

import type { Pool, PoolClient } from "pg";
import { normalisePhone, slugify } from "./format";

export const OSM_SOURCE = "OpenStreetMap";

/** Rough box around Lagos State (south, west, north, east), used only as a fallback. */
export const LAGOS_BBOX = [6.36, 2.7, 6.72, 4.36] as const;

/** OpenStreetMap's code for the Lagos State boundary. */
export const LAGOS_ISO = "NG-LA";

export type OsmElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

/**
 * OSM tag -> FindAm category slug. Checked in order; first match wins.
 * Only categories FindAm serves are imported, everything else is skipped.
 */
const RULES: { test: (t: Record<string, string>) => boolean; category: string }[] = [
  { test: (t) => t.shop === "mobile_phone" || t.craft === "mobile_phone_repair" || t.repair === "mobile_phone", category: "phone-repair" },
  { test: (t) => t.shop === "computer" || t.repair === "computer", category: "laptop-repair" },
  { test: (t) => t.craft === "electronics_repair" || t.shop === "electronics_repair" || (t.shop === "electronics" && !!t.repair), category: "electronics-repair" },
  { test: (t) => t.craft === "hvac" || t.repair === "air_conditioner", category: "ac-repair" },
  { test: (t) => t.craft === "plumber", category: "plumbing" },
  { test: (t) => t.craft === "electrician", category: "electrical" },
  { test: (t) => t.craft === "carpenter" || t.craft === "joiner", category: "carpentry" },
  { test: (t) => t.craft === "painter", category: "painting" },
  { test: (t) => t.craft === "caterer" || t.shop === "caterer", category: "caterers" },
  { test: (t) => t.amenity === "restaurant" || t.amenity === "fast_food" || t.amenity === "food_court", category: "restaurants" },
  { test: (t) => t.shop === "hairdresser" && (t.hairdresser === "barber" || t.male === "yes" || /barb/i.test(t.name ?? "")), category: "barbers" },
  { test: (t) => t.shop === "hairdresser", category: "hair-salons" },
  { test: (t) => t.shop === "beauty" || t.shop === "cosmetics", category: "makeup" },
  { test: (t) => t.shop === "car_repair" || t.amenity === "car_repair" || t.craft === "car_repair", category: "mechanics" },
  { test: (t) => t.shop === "tyres", category: "vulcanisers" },
  { test: (t) => t.craft === "tailor" || t.shop === "tailor" || t.craft === "dressmaker", category: "tailors" },
];

export function categoryFor(tags: Record<string, string>): string | null {
  return RULES.find((r) => r.test(tags))?.category ?? null;
}

/**
 * The Overpass query that fetches everything RULES can map inside Lagos State.
 * By default it uses the state's official boundary, so nothing from Ogun State
 * or the sea comes in. Pass a bounding box to search a rectangle instead.
 */
export function overpassQuery(opts: { bbox?: readonly number[] } = {}): string {
  const where = opts.bbox ? `(${opts.bbox.join(",")})` : "(area.lagos)";
  const head = opts.bbox ? "" : `area["ISO3166-2"="${LAGOS_ISO}"]["boundary"="administrative"]->.lagos;\n`;
  const filters = [
    '["shop"~"^(mobile_phone|computer|electronics_repair|electronics|caterer|hairdresser|beauty|cosmetics|car_repair|tyres|tailor)$"]',
    '["craft"~"^(mobile_phone_repair|electronics_repair|hvac|plumber|electrician|carpenter|joiner|painter|caterer|car_repair|tailor|dressmaker)$"]',
    '["amenity"~"^(restaurant|fast_food|food_court|car_repair)$"]',
  ];
  const parts = filters.flatMap((f) => [`node${f}["name"]${where};`, `way${f}["name"]${where};`]);
  return `[out:json][timeout:300];\n${head}(\n${parts.join("\n")}\n);out center tags;`;
}

export type MappedListing = {
  ref: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  phone: string | null;
  whatsapp: string | null;
  streetAddress: string | null;
  description: string | null;
  hoursNote: string | null;
};

/** One OSM element -> a listing, or the reason it was skipped. */
export function mapElement(el: OsmElement): MappedListing | { skip: string } {
  const t = el.tags ?? {};
  const name = (t.name ?? t["name:en"] ?? "").trim();
  if (!name) return { skip: "no name" };
  if (t.disused === "yes" || t["disused:shop"] || t["abandoned:shop"]) return { skip: "closed" };
  const category = categoryFor(t);
  if (!category) return { skip: "category not served" };
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (lat == null || lng == null) return { skip: "no location" };

  const firstPhone = (v?: string) => {
    for (const p of (v ?? "").split(/[;,/]/)) {
      const n = normalisePhone(p);
      if (n) return n;
    }
    return null;
  };
  const phone = firstPhone(t.phone) ?? firstPhone(t["contact:phone"]) ?? firstPhone(t.mobile) ?? firstPhone(t["contact:mobile"]);
  // Only mark a number as WhatsApp when OSM says so; don't guess.
  const whatsapp = firstPhone(t["contact:whatsapp"]) ?? firstPhone(t.whatsapp);

  const street = [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" ").trim();
  const streetAddress = street || t["addr:full"] || null;

  return {
    ref: `${el.type}/${el.id}`,
    name: name.slice(0, 80),
    category,
    lat,
    lng,
    phone,
    whatsapp,
    streetAddress: streetAddress ? streetAddress.slice(0, 200) : null,
    description: t.description ? t.description.slice(0, 300) : null,
    hoursNote: t.opening_hours ? t.opening_hours.slice(0, 80) : null,
  };
}

export type ImportSummary = {
  seen: number;
  created: number;
  updated: number;
  skipped: Record<string, number>;
};

/**
 * Inserts or refreshes imported listings. Safe to run again: rows are matched
 * on their OSM id. A row is only refreshed while it is still an unclaimed
 * import; once an owner claims it, or it is removed or closed, the import
 * leaves it alone. Listings that FindAm already has (same name within 150 m)
 * are skipped so they don't appear twice.
 */
export async function importElements(
  db: Pool | PoolClient,
  elements: OsmElement[],
  opts: { dryRun?: boolean; maxAreaKm?: number } = {},
): Promise<ImportSummary> {
  // Every place inside Lagos goes to its nearest FindAm area. 25 km reaches
  // the far ends of the state (east of Epe, west of Badagry) without pulling
  // in anything that has wandered in from elsewhere.
  const maxAreaM = (opts.maxAreaKm ?? 25) * 1000;
  const summary: ImportSummary = { seen: 0, created: 0, updated: 0, skipped: {} };
  const skip = (why: string) => (summary.skipped[why] = (summary.skipped[why] ?? 0) + 1);

  const cats = new Map(
    (await db.query<{ id: number; slug: string }>("SELECT id, slug FROM categories")).rows.map((c) => [c.slug, c.id]),
  );
  const seenRefs = new Set<string>();

  for (const el of elements) {
    summary.seen++;
    const m = mapElement(el);
    if ("skip" in m) {
      skip(m.skip);
      continue;
    }
    if (seenRefs.has(m.ref)) {
      skip("duplicate in file");
      continue;
    }
    seenRefs.add(m.ref);
    const categoryId = cats.get(m.category);
    if (!categoryId) {
      skip("category missing in database");
      continue;
    }

    const point = [m.lng, m.lat];

    // Nearest FindAm area within reach. Looked up for every place, so a
    // re-run also moves earlier imports into newly added areas.
    const area = await db.query<{ id: number; slug: string }>(
      `SELECT id, slug FROM areas
       WHERE centre IS NOT NULL AND ST_DWithin(centre, ST_MakePoint($1, $2)::geography, $3)
       ORDER BY ST_Distance(centre, ST_MakePoint($1, $2)::geography) LIMIT 1`,
      [...point, maxAreaM],
    );

    const existing = await db.query<{ id: string; status: string; owner_id: string | null; source: string }>(
      "SELECT id, status, owner_id, source FROM businesses WHERE source_name = $1 AND source_ref = $2",
      [OSM_SOURCE, m.ref],
    );

    if (existing.rows[0]) {
      const row = existing.rows[0];
      if (row.source !== "import" || row.owner_id || ["removed", "closed", "rejected"].includes(row.status)) {
        skip("claimed or removed, left alone");
        continue;
      }
      if (!opts.dryRun) {
        await db.query(
          `UPDATE businesses SET name = $2, category_id = $3, location = ST_MakePoint($4, $5)::geography,
             phone = $6, whatsapp = $7, street_address = $8, description = $9, hours_note = $10, imported_at = now(),
             area_id = coalesce($11, area_id)
           WHERE id = $1`,
          [row.id, m.name, categoryId, ...point, m.phone, m.whatsapp, m.streetAddress, m.description, m.hoursNote,
           area.rows[0]?.id ?? null],
        );
      }
      summary.updated++;
      continue;
    }

    if (!area.rows[0]) {
      skip("outside FindAm areas");
      continue;
    }

    const dupe = await db.query(
      `SELECT 1 FROM businesses
       WHERE status NOT IN ('rejected','removed') AND location IS NOT NULL
         AND ST_DWithin(location, ST_MakePoint($1, $2)::geography, 150)
         AND similarity(lower(name), lower($3)) > 0.5
       LIMIT 1`,
      [...point, m.name],
    );
    if (dupe.rows[0]) {
      skip("already on FindAm");
      continue;
    }

    if (!opts.dryRun) {
      const base = slugify(`${m.name} ${area.rows[0].slug}`) || "business";
      const taken = new Set(
        (await db.query<{ slug: string }>("SELECT slug FROM businesses WHERE slug = $1 OR slug LIKE $1 || '-%'", [base])).rows.map((r) => r.slug),
      );
      let slug = base;
      for (let i = 2; taken.has(slug); i++) slug = `${base}-${i}`;

      await db.query(
        `INSERT INTO businesses (name, slug, category_id, area_id, location, phone, whatsapp, street_address,
           description, hours_note, status, source, source_name, source_ref, imported_at, verification_level)
         VALUES ($1, $2, $3, $4, ST_MakePoint($5, $6)::geography, $7, $8, $9, $10, $11,
           'live', 'import', $12, $13, now(), 'none')`,
        [m.name, slug, categoryId, area.rows[0].id, ...point, m.phone, m.whatsapp, m.streetAddress,
         m.description, m.hoursNote, OSM_SOURCE, m.ref],
      );
    }
    summary.created++;
  }
  return summary;
}
