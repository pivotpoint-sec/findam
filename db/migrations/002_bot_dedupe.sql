-- Meta can deliver the same webhook more than once; remember message ids so
-- the bot answers each message once. Old rows can be deleted after a week.
CREATE TABLE bot_messages_seen (
  id      TEXT PRIMARY KEY,
  seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX bot_messages_seen_at ON bot_messages_seen (seen_at);

-- Owners can reply STOP to turn off the weekly check messages.
ALTER TABLE users ADD COLUMN pings_off BOOLEAN NOT NULL DEFAULT FALSE;
