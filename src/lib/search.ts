import { query } from "./db";

// Words people add to searches that don't describe the business, in English
// and Pidgin ("where I fit fix my gen for Ikeja" -> ["fix", "gen", "ikeja"]).
const STOPWORDS = new Set([
  "a", "an", "the", "for", "in", "at", "to", "of", "and", "or", "my", "me", "i", "near", "nearby",
  "around", "close", "closest", "best", "good", "cheap", "where", "who", "fit", "dey", "wetin",
  "wan", "want", "need", "get", "find", "person", "somebody", "someone", "abeg", "pls", "please",
  "area", "side", "inside", "shop", "place", "una", "na", "go", "can", "is", "there", "any",
]);

export function searchTokens(q: string): string[] {
  return q
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t))
    .slice(0, 6);
}

export type SearchParams = {
  q?: string;
  area?: string;        // area slug
  category?: string;    // category slug (parent slugs include their children)
  market?: string;      // market slug
  lat?: number;
  lng?: number;
  verifiedOnly?: boolean;
  openNow?: boolean;
  comesToYou?: boolean;
  sort?: "best" | "nearest";
  page?: number;
  pageSize?: number;
};

export type SearchResult = {
  id: string;
  slug: string;
  name: string;
  category: string | null;
  area: string | null;
  market: string | null;
  section: string | null;
  parent_section: string | null;
  shop_number: string | null;
  verification_level: "none" | "phone" | "visited" | "cac";
  is_open_now: boolean | null;
  open_status_note: string | null;
  open_status_at: string | null;
  last_confirmed_at: string | null;
  price_min_ngn: number | null;
  price_max_ngn: number | null;
  comes_to_you: boolean;
  covers_user_area: boolean | null;
  whatsapp: string | null;
  phone: string | null;
  distance_m: number | null;
  lat: number | null;
  lng: number | null;
  rating: number | null;
  review_count: number;
  photo_url: string | null;
  relevance: number;
};

export type SearchOutcome = {
  results: SearchResult[];
  hasMore: boolean;
  origin: "you" | "area" | null;
  originArea: { name: string; slug: string } | null;
};

/** Hours after which an owner's open/closed toggle no longer counts. */
export const OPEN_STATUS_HOURS = 16;

export async function searchBusinesses(p: SearchParams): Promise<SearchOutcome> {
  const tokens = p.q ? searchTokens(p.q) : [];
  const pageSize = Math.min(p.pageSize ?? 20, 50);
  const page = Math.max(1, p.page ?? 1);
  const hasUserLocation = Number.isFinite(p.lat) && Number.isFinite(p.lng);

  const params: unknown[] = [];
  const add = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };

  // Origin for distance: the user's own position, or the centre of the area
  // they picked, or nothing.
  let originSql = "NULL::geography";
  if (hasUserLocation) originSql = `ST_MakePoint(${add(p.lng)}, ${add(p.lat)})::geography`;
  else if (p.area) originSql = `(SELECT centre FROM areas WHERE slug = ${add(p.area)})`;

  const where: string[] = ["b.status = 'live'"];

  // How well one search word matches a listing: short words ("ac", "gen",
  // "vi") must match a whole word; longer ones may be misspelt ("plumbr").
  const tokenScore = (t: string) => `CASE WHEN length(${t}) <= 3
      THEN CASE WHEN b.search_text ~ ('\\m' || ${t} || '\\M') THEN 1.0 ELSE 0.0 END
      ELSE word_similarity(${t}, b.search_text) END`;

  if (tokens.length) {
    // Every meaningful word must roughly appear somewhere in the listing.
    where.push(`NOT EXISTS (SELECT 1 FROM unnest(${add(tokens)}::text[]) t
                WHERE ${tokenScore("t")} < 0.5)`);
  }
  if (p.category) {
    const c = add(p.category);
    where.push(`b.category_id IN (SELECT id FROM categories WHERE slug = ${c}
                UNION SELECT ch.id FROM categories ch JOIN categories pa ON pa.id = ch.parent_id WHERE pa.slug = ${c})`);
  }
  if (p.market) {
    where.push(`m.slug = ${add(p.market)}`);
  }
  if (p.area && !hasUserLocation) {
    // In the chosen area, or an artisan who comes to that area.
    const a = add(p.area);
    where.push(`(ar.slug = ${a} OR (b.comes_to_you AND (SELECT id FROM areas WHERE slug = ${a}) = ANY (b.service_area_ids)))`);
  }
  if (p.verifiedOnly) where.push(`b.verification_level IN ('visited','cac')`);
  if (p.openNow) {
    where.push(`b.is_open_now = TRUE AND b.open_status_at > now() - interval '${OPEN_STATUS_HOURS} hours'`);
  }
  if (p.comesToYou) where.push("b.comes_to_you");

  const relevanceSql = tokens.length
    ? `(SELECT avg(${tokenScore("t")}) FROM unnest(${add(tokens)}::text[]) t)`
    : "0";
  // Someone typing a business's name should see that business first.
  const nameScoreSql = tokens.length
    ? `word_similarity(${add(tokens.join(" "))}, lower(unaccent(b.name)))`
    : "0";

  // Blended rank: trust, how well the words match, and how close it is.
  // Artisans who come to you get a closeness bonus if they cover the user's area.
  const orderSql =
    p.sort === "nearest"
      ? "covers_user_area DESC NULLS LAST, distance_m ASC NULLS LAST, trust_score DESC"
      : `(trust_score * 0.4 + relevance * 40 +
          CASE WHEN name_score >= 0.8 THEN 60 ELSE 0 END +
          CASE WHEN comes_to_you AND covers_user_area THEN 30
               WHEN comes_to_you THEN 0
               WHEN distance_m IS NULL THEN 0
               ELSE 40 * exp(-distance_m / 3000.0) END) DESC`;

  const limitSql = add(pageSize + 1);
  const offsetSql = add((page - 1) * pageSize);

  const sql = `
    WITH origin AS (SELECT ${originSql} AS g),
    user_area AS (
      -- The area whose centre is nearest the origin, for "covers your area".
      SELECT a.id FROM areas a, origin o
      WHERE o.g IS NOT NULL AND a.centre IS NOT NULL
      ORDER BY ST_Distance(a.centre, o.g) LIMIT 1
    ),
    hits AS (
      SELECT b.id, b.slug, b.name, c.name AS category, ar.name AS area, m.name AS market,
             s.name AS section, ps.name AS parent_section, b.shop_number,
             b.verification_level, b.is_open_now, b.open_status_note, b.open_status_at,
             b.last_confirmed_at, b.price_min_ngn, b.price_max_ngn, b.comes_to_you,
             b.whatsapp, b.phone, b.trust_score::float AS trust_score,
             CASE WHEN b.comes_to_you THEN (SELECT id FROM user_area) = ANY (b.service_area_ids) END AS covers_user_area,
             CASE WHEN b.comes_to_you OR b.location IS NULL THEN NULL
                  ELSE ST_Distance(b.location, (SELECT g FROM origin)) END AS distance_m,
             ST_Y(b.location::geometry) AS lat, ST_X(b.location::geometry) AS lng,
             ${relevanceSql}::float AS relevance,
             ${nameScoreSql}::float AS name_score
      FROM businesses b
      LEFT JOIN categories c       ON c.id = b.category_id
      LEFT JOIN areas ar           ON ar.id = b.area_id
      LEFT JOIN market_sections s  ON s.id = b.market_section_id
      LEFT JOIN market_sections ps ON ps.id = s.parent_id
      LEFT JOIN markets m          ON m.id = s.market_id
      WHERE ${where.join(" AND ")}
    )
    SELECT h.*,
           r.rating, coalesce(r.review_count, 0)::int AS review_count,
           (SELECT url FROM business_photos ph WHERE ph.business_id = h.id
             ORDER BY (ph.kind = 'entrance') DESC, ph.sort_order LIMIT 1) AS photo_url
    FROM hits h
    LEFT JOIN LATERAL (
      SELECT round(avg(rating)::numeric, 1)::float AS rating, count(*) AS review_count
      FROM reviews WHERE business_id = h.id AND status = 'live'
    ) r ON TRUE
    ORDER BY ${orderSql}
    LIMIT ${limitSql} OFFSET ${offsetSql}`;

  const rows = await query<SearchResult & { trust_score: number }>(sql, params);

  let originArea: SearchOutcome["originArea"] = null;
  if (p.area && !hasUserLocation) {
    const a = await query<{ name: string; slug: string }>("SELECT name, slug FROM areas WHERE slug = $1", [p.area]);
    originArea = a[0] ?? null;
  }

  return {
    results: rows.slice(0, pageSize),
    hasMore: rows.length > pageSize,
    origin: hasUserLocation ? "you" : originArea ? "area" : null,
    originArea,
  };
}

/** Open status as shown to searchers, given how fresh the owner's toggle is. */
export function openState(b: {
  is_open_now: boolean | null;
  open_status_at: string | Date | null;
}): "open" | "closed" | "unknown" {
  if (b.is_open_now == null || !b.open_status_at) return "unknown";
  const age = Date.now() - new Date(b.open_status_at).getTime();
  if (age > OPEN_STATUS_HOURS * 3_600_000) return "unknown";
  return b.is_open_now ? "open" : "closed";
}
