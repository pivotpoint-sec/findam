import { query, queryOne } from "./db";

export type PriceItem = { label: string; min?: number; max?: number };

export type BusinessDetail = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string | null;
  category_slug: string | null;
  area: string | null;
  area_slug: string | null;
  market: string | null;
  market_slug: string | null;
  section: string | null;
  parent_section: string | null;
  shop_number: string | null;
  landmark_directions: string | null;
  street_address: string | null;
  lat: number | null;
  lng: number | null;
  whatsapp: string | null;
  phone: string | null;
  instagram: string | null;
  price_min_ngn: number | null;
  price_max_ngn: number | null;
  price_items: PriceItem[];
  comes_to_you: boolean;
  service_areas: string[];
  hours_note: string | null;
  is_open_now: boolean | null;
  open_status_note: string | null;
  open_status_at: string | null;
  verification_level: "none" | "phone" | "visited" | "cac";
  last_confirmed_at: string | null;
  status: string;
  rating: number | null;
  review_count: number;
};

export async function getBusinessBySlug(slug: string): Promise<BusinessDetail | null> {
  return queryOne<BusinessDetail>(
    `SELECT b.id, b.slug, b.name, b.description, c.name AS category, c.slug AS category_slug,
            ar.name AS area, ar.slug AS area_slug, m.name AS market, m.slug AS market_slug,
            s.name AS section, ps.name AS parent_section, b.shop_number,
            b.landmark_directions, b.street_address,
            ST_Y(b.location::geometry) AS lat, ST_X(b.location::geometry) AS lng,
            b.whatsapp, b.phone, b.instagram, b.price_min_ngn, b.price_max_ngn, b.price_items,
            b.comes_to_you,
            coalesce((SELECT array_agg(a2.name ORDER BY a2.name) FROM areas a2
                      WHERE a2.id = ANY (b.service_area_ids)), '{}') AS service_areas,
            b.hours_note, b.is_open_now, b.open_status_note, b.open_status_at,
            b.verification_level, b.last_confirmed_at, b.status,
            (SELECT round(avg(rating)::numeric, 1)::float FROM reviews r
              WHERE r.business_id = b.id AND r.status = 'live') AS rating,
            (SELECT count(*)::int FROM reviews r
              WHERE r.business_id = b.id AND r.status = 'live') AS review_count
     FROM businesses b
     LEFT JOIN categories c       ON c.id = b.category_id
     LEFT JOIN areas ar           ON ar.id = b.area_id
     LEFT JOIN market_sections s  ON s.id = b.market_section_id
     LEFT JOIN market_sections ps ON ps.id = s.parent_id
     LEFT JOIN markets m          ON m.id = s.market_id
     WHERE b.slug = $1`,
    [slug],
  );
}

export async function getPhotos(businessId: string) {
  return query<{ id: string; kind: string; url: string }>(
    `SELECT id, kind, url FROM business_photos WHERE business_id = $1
     ORDER BY (kind = 'entrance') DESC, sort_order, created_at`,
    [businessId],
  );
}

export async function getReviews(businessId: string, limit = 10) {
  return query<{ id: string; reviewer_name: string; rating: number; body: string | null; created_at: string }>(
    `SELECT id, reviewer_name, rating, body, created_at FROM reviews
     WHERE business_id = $1 AND status = 'live' ORDER BY created_at DESC LIMIT $2`,
    [businessId, limit],
  );
}

export async function recordView(businessId: string) {
  await query(
    `INSERT INTO listing_views (business_id, day, views) VALUES ($1, current_date, 1)
     ON CONFLICT (business_id, day) DO UPDATE SET views = listing_views.views + 1`,
    [businessId],
  );
}

/** Views and contacts over the last 7 days, for owner stats. */
export async function weeklyStats(businessId: string) {
  const row = await queryOne<{ views: number; contacts: number }>(
    `SELECT
       coalesce((SELECT sum(views) FROM listing_views
                 WHERE business_id = $1 AND day > current_date - 7), 0)::int AS views,
       (SELECT count(*) FROM contact_events
         WHERE business_id = $1 AND created_at > now() - interval '7 days')::int AS contacts`,
    [businessId],
  );
  return row ?? { views: 0, contacts: 0 };
}

export async function listAreas() {
  return query<{ id: number; name: string; slug: string }>(
    "SELECT id, name, slug FROM areas ORDER BY name",
  );
}

export async function listCategories() {
  return query<{ id: number; name: string; slug: string; parent_id: number | null; parent_slug: string | null }>(
    `SELECT c.id, c.name, c.slug, c.parent_id, p.slug AS parent_slug
     FROM categories c LEFT JOIN categories p ON p.id = c.parent_id
     ORDER BY coalesce(p.sort_order, c.sort_order), c.parent_id NULLS FIRST, c.sort_order`,
  );
}

export async function listMarketSections() {
  return query<{ id: number; label: string; market_slug: string }>(
    `SELECT s.id, m.name || ' · ' || coalesce(p.name || ' · ', '') || s.name AS label, m.slug AS market_slug
     FROM market_sections s
     JOIN markets m ON m.id = s.market_id
     LEFT JOIN market_sections p ON p.id = s.parent_id
     ORDER BY m.name, coalesce(p.sort_order, s.sort_order), s.parent_id NULLS FIRST, s.sort_order`,
  );
}

/** Unique slug from a business name: "chidi-phone-clinic", "chidi-phone-clinic-2", ... */
export async function uniqueSlug(base: string): Promise<string> {
  const root = base || "business";
  const taken = await query<{ slug: string }>(
    "SELECT slug FROM businesses WHERE slug = $1 OR slug LIKE $1 || '-%'",
    [root],
  );
  const set = new Set(taken.map((t) => t.slug));
  if (!set.has(root)) return root;
  for (let i = 2; ; i++) if (!set.has(`${root}-${i}`)) return `${root}-${i}`;
}
