-- Imported listings (e.g. from OpenStreetMap), owner claims and removals.

-- Where a listing came from. Imported rows keep the source and its id so
-- re-running an import updates them instead of duplicating them.
ALTER TABLE businesses DROP CONSTRAINT businesses_source_check;
ALTER TABLE businesses ADD CONSTRAINT businesses_source_check
  CHECK (source IN ('web','bot','agent','import'));

ALTER TABLE businesses ADD COLUMN source_name TEXT;        -- 'OpenStreetMap'
ALTER TABLE businesses ADD COLUMN source_ref  TEXT;        -- 'node/123456'
ALTER TABLE businesses ADD COLUMN imported_at TIMESTAMPTZ;
CREATE UNIQUE INDEX businesses_source_ref ON businesses (source_name, source_ref);

-- 'removed': the owner asked us to take it down. Kept (not deleted) so a
-- later import never brings it back.
ALTER TABLE businesses DROP CONSTRAINT businesses_status_check;
ALTER TABLE businesses ADD CONSTRAINT businesses_status_check
  CHECK (status IN ('pending','live','hidden','closed','rejected','removed'));

-- Owners asking for their listing to be taken down.
ALTER TABLE reports DROP CONSTRAINT reports_reason_check;
ALTER TABLE reports ADD CONSTRAINT reports_reason_check
  CHECK (reason IN ('closed','moved','wrong_contact','scam','other','owner_removal'));
ALTER TABLE reports ADD COLUMN contact_phone TEXT;

-- Someone saying "this is my business" whose number doesn't match the
-- listing. The team calls them to check before linking it.
CREATE TABLE claim_requests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  phone       TEXT NOT NULL,                 -- E.164
  name        TEXT,
  note        TEXT,
  channel     TEXT NOT NULL CHECK (channel IN ('bot','web')),
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at  TIMESTAMPTZ
);
CREATE UNIQUE INDEX claim_requests_one_pending ON claim_requests (business_id, phone) WHERE status = 'pending';
CREATE INDEX claim_requests_status ON claim_requests (status, created_at);
