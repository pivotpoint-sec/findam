-- FindAm v1 schema. Matches the product spec, plus the tables the WhatsApp
-- bot and background jobs need (bot_sessions, listing_views).

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Places ----------------------------------------------------------------------

CREATE TABLE cities (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  state       TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  is_live     BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE areas (
  id          SERIAL PRIMARY KEY,
  city_id     INT NOT NULL REFERENCES cities(id),
  name        TEXT NOT NULL,                 -- 'Yaba', 'Lekki Phase 1'
  aliases     TEXT[] NOT NULL DEFAULT '{}',  -- 'Lekki 1', 'Lekki Ph 1'
  slug        TEXT NOT NULL,
  boundary    GEOGRAPHY(POLYGON),
  centre      GEOGRAPHY(POINT),              -- fallback origin for distance
  UNIQUE (city_id, slug)
);

CREATE TABLE markets (
  id          SERIAL PRIMARY KEY,
  area_id     INT NOT NULL REFERENCES areas(id),
  name        TEXT NOT NULL,                 -- 'Computer Village'
  slug        TEXT UNIQUE NOT NULL,
  description TEXT,
  location    GEOGRAPHY(POINT)
);

CREATE TABLE market_sections (
  id          SERIAL PRIMARY KEY,
  market_id   INT NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  parent_id   INT REFERENCES market_sections(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('street','plaza','line','block','floor')),
  name        TEXT NOT NULL,                 -- 'Otigba Street', 'Line 2'
  sort_order  INT NOT NULL DEFAULT 0
);

CREATE TABLE categories (
  id          SERIAL PRIMARY KEY,
  parent_id   INT REFERENCES categories(id),
  name        TEXT NOT NULL,
  synonyms    TEXT[] NOT NULL DEFAULT '{}',  -- 'gen repair', 'generator man'
  slug        TEXT UNIQUE NOT NULL,
  sort_order  INT NOT NULL DEFAULT 0
);

-- People ----------------------------------------------------------------------

CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       TEXT UNIQUE NOT NULL,          -- E.164, e.g. +2348012345678
  name        TEXT,
  role        TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','owner','agent','admin')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Businesses -------------------------------------------------------------------

CREATE TABLE businesses (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  slug                TEXT UNIQUE NOT NULL,
  category_id         INT REFERENCES categories(id),
  area_id             INT REFERENCES areas(id),
  market_section_id   INT REFERENCES market_sections(id),
  shop_number         TEXT,                  -- 'D47'
  owner_id            UUID REFERENCES users(id),
  description         TEXT,
  landmark_directions TEXT,                  -- 'Opposite Mobil, blue gate'
  street_address      TEXT,
  location            GEOGRAPHY(POINT),
  whatsapp            TEXT,                  -- E.164
  phone               TEXT,                  -- E.164
  instagram           TEXT,
  price_min_ngn       INT,
  price_max_ngn       INT,
  price_items         JSONB NOT NULL DEFAULT '[]', -- [{"label":"Battery","min":8000,"max":20000}]
  comes_to_you        BOOLEAN NOT NULL DEFAULT FALSE,
  service_area_ids    INT[] NOT NULL DEFAULT '{}',
  hours_note          TEXT,                  -- 'Mon-Sat, roughly 9-7'
  is_open_now         BOOLEAN,
  open_status_note    TEXT,                  -- 'Light issue, back tomorrow'
  open_status_at      TIMESTAMPTZ,
  verification_level  TEXT NOT NULL DEFAULT 'none' CHECK (verification_level IN ('none','phone','visited','cac')),
  last_confirmed_at   TIMESTAMPTZ,
  last_pinged_at      TIMESTAMPTZ,
  trust_score         NUMERIC(5,2) NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','live','hidden','closed','rejected')),
  source              TEXT NOT NULL DEFAULT 'web' CHECK (source IN ('web','bot','agent','import')),
  created_by          UUID REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  search_text         TEXT NOT NULL DEFAULT ''   -- maintained by trigger below
);

CREATE INDEX businesses_geo      ON businesses USING GIST (location);
CREATE INDEX businesses_search   ON businesses USING GIN (search_text gin_trgm_ops);
CREATE INDEX businesses_status   ON businesses (status);
CREATE INDEX businesses_area     ON businesses (area_id);
CREATE INDEX businesses_category ON businesses (category_id);
CREATE INDEX businesses_section  ON businesses (market_section_id);
CREATE INDEX businesses_whatsapp ON businesses (whatsapp);

CREATE TABLE business_photos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('entrance','shopfront','work','logo')),
  url         TEXT NOT NULL,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX business_photos_business ON business_photos (business_id);

-- Activity ---------------------------------------------------------------------

CREATE TABLE contact_events (
  id          BIGSERIAL PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id),     -- null when not logged in
  visitor_id  TEXT,                          -- anonymous cookie id
  channel     TEXT NOT NULL CHECK (channel IN ('whatsapp','call','directions')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX contact_events_business ON contact_events (business_id, created_at);

-- Daily view counts per listing, for owner stats.
CREATE TABLE listing_views (
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  day         DATE NOT NULL,
  views       INT NOT NULL DEFAULT 0,
  PRIMARY KEY (business_id, day)
);

CREATE TABLE reviews (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id          UUID REFERENCES users(id),
  reviewer_name    TEXT NOT NULL,
  contact_event_id BIGINT NOT NULL UNIQUE REFERENCES contact_events(id),
  rating           SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body             TEXT,
  status           TEXT NOT NULL DEFAULT 'live' CHECK (status IN ('live','flagged','removed')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX reviews_business ON reviews (business_id);

CREATE TABLE reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id),
  reason      TEXT NOT NULL CHECK (reason IN ('closed','moved','wrong_contact','scam','other')),
  note        TEXT,
  resolved    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX reports_open ON reports (resolved, created_at);

CREATE TABLE verifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  agent_id    UUID REFERENCES users(id),
  method      TEXT NOT NULL CHECK (method IN ('phone','visit','cac','owner_confirm')),
  evidence    JSONB,                         -- photo urls, GPS, CAC number
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Revenue (switched on after the free phase) ------------------------------------

CREATE TABLE subscriptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  plan         TEXT NOT NULL CHECK (plan IN ('premium')),
  amount_ngn   INT NOT NULL,
  starts_at    TIMESTAMPTZ NOT NULL,
  ends_at      TIMESTAMPTZ NOT NULL,
  paystack_ref TEXT
);

CREATE TABLE adverts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  placement    TEXT NOT NULL CHECK (placement IN ('category','area','market','search')),
  category_id  INT REFERENCES categories(id),
  area_id      INT REFERENCES areas(id),
  market_id    INT REFERENCES markets(id),
  image_url    TEXT,
  headline     TEXT NOT NULL,
  starts_at    TIMESTAMPTZ NOT NULL,
  ends_at      TIMESTAMPTZ NOT NULL,
  amount_ngn   INT NOT NULL,
  views        INT NOT NULL DEFAULT 0,
  taps         INT NOT NULL DEFAULT 0,
  paystack_ref TEXT
);

-- WhatsApp bot conversation state, one row per phone number.
CREATE TABLE bot_sessions (
  phone       TEXT PRIMARY KEY,              -- E.164
  state       TEXT NOT NULL DEFAULT 'idle',
  data        JSONB NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Search text --------------------------------------------------------------------
-- One lower-cased string per business with everything people might type:
-- name, category and its synonyms, parent category, area and aliases, market,
-- market sections, shop number and description. Searched with pg_trgm so typos
-- and partial words still match.

CREATE OR REPLACE FUNCTION business_search_text(b businesses) RETURNS TEXT
LANGUAGE sql STABLE AS $$
  SELECT lower(unaccent(concat_ws(' ',
    b.name,
    c.name, array_to_string(c.synonyms, ' '),
    pc.name, array_to_string(pc.synonyms, ' '),
    a.name, array_to_string(a.aliases, ' '),
    m.name, s.name, ps.name,
    b.shop_number,
    b.description
  )))
  FROM (SELECT 1) one
  LEFT JOIN categories c       ON c.id = b.category_id
  LEFT JOIN categories pc      ON pc.id = c.parent_id
  LEFT JOIN areas a            ON a.id = b.area_id
  LEFT JOIN market_sections s  ON s.id = b.market_section_id
  LEFT JOIN market_sections ps ON ps.id = s.parent_id
  LEFT JOIN markets m          ON m.id = s.market_id
$$;

CREATE OR REPLACE FUNCTION businesses_before_write() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_text := coalesce(business_search_text(NEW), '');
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE TRIGGER businesses_search_text
  BEFORE INSERT OR UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION businesses_before_write();

-- Trust score and freshness -------------------------------------------------------
-- Score out of 100:
--   verification  visited/cac 40, phone 20
--   freshness     up to 30, falling to 0 at 90 days since last confirmation
--   reviews       up to 20: average rating, weighted until 10 reviews
--   activity      up to 10: contacts in the last 30 days
--   reports       minus 10 per unresolved report
-- Live listings unconfirmed for 90 days are hidden; confirming brings them back.

CREATE OR REPLACE FUNCTION recompute_trust() RETURNS TABLE (updated INT, hidden INT)
LANGUAGE plpgsql AS $$
DECLARE
  n_updated INT;
  n_hidden INT;
BEGIN
  WITH stats AS (
    SELECT b.id,
      CASE b.verification_level WHEN 'visited' THEN 40 WHEN 'cac' THEN 40 WHEN 'phone' THEN 20 ELSE 0 END AS v,
      CASE WHEN b.last_confirmed_at IS NULL THEN 0
           ELSE greatest(0, 30 * (1 - extract(epoch FROM now() - b.last_confirmed_at) / (90 * 86400.0))) END AS f,
      coalesce((SELECT avg(r.rating) / 5.0 * 20 * least(1, count(*) / 10.0)
                FROM reviews r WHERE r.business_id = b.id AND r.status = 'live'), 0) AS r,
      (SELECT least(10, count(*)) FROM contact_events e
        WHERE e.business_id = b.id AND e.created_at > now() - interval '30 days') AS a,
      (SELECT count(*) * 10 FROM reports p WHERE p.business_id = b.id AND NOT p.resolved) AS p
    FROM businesses b
    WHERE b.status IN ('live','hidden')
  )
  UPDATE businesses b
     SET trust_score = greatest(0, least(100, s.v + s.f + s.r + s.a - s.p))
    FROM stats s
   WHERE b.id = s.id;
  GET DIAGNOSTICS n_updated = ROW_COUNT;

  UPDATE businesses
     SET status = 'hidden'
   WHERE status = 'live'
     AND coalesce(last_confirmed_at, created_at) < now() - interval '90 days';
  GET DIAGNOSTICS n_hidden = ROW_COUNT;

  RETURN QUERY SELECT n_updated, n_hidden;
END $$;
