# FindAm

A Lagos city directory for the businesses Google misses: landmark directions,
shop numbers inside markets, WhatsApp-first contact, and listings that are
checked to still be open.

This is the first version described in the product spec: the public web app,
the owner WhatsApp bot, the field-agent and admin tools, and the background
jobs that keep listings fresh.

## What's in v1

**For people searching**
- Search that tolerates typos and Pidgin ("where I fit fix my gen for Ikeja")
- Filters: area, category, verified only, open now, comes to you
- Distance and nearest-first sorting when location is allowed; falls back to
  the centre of the chosen area when it isn't
- Optional driving time for the top 5 results (needs an OSRM server)
- Listing pages with landmark directions, entrance photo, market location
  (market, street, line, shop number), price guide, hours, reviews
- "Chat on WhatsApp", "Call" and "Open in Maps" buttons, each recorded as a
  contact event
- Reviews only from visitors who actually tapped WhatsApp or call
- "Report a problem" (closed, moved, wrong number, scam)
- Market pages: browse Computer Village by street and line, search by shop number

**For business owners**
- Free listing form on the website (goes to review)
- WhatsApp bot: guided listing in a chat, then `OPEN`, `CLOSE [reason]`,
  `STATS`, `LINK`, `MOVED`, `NEW`, `STOP`
- Listings made by agents link to the owner automatically the first time they
  message the bot from the same number
- Weekly "still at the same place?" check with last week's views and chats

**For the team** (`/admin`, password protected)
- Overview with the roadmap gate numbers (taps per week, share confirmed)
- Review queue for new listings, reports queue, "to revisit" list by area
- Field-agent form: listings go live with the "Visited by FindAm agent" badge
- Edit any listing, mark visited, hide or close
- Bot test chat, so you can try the bot without WhatsApp

**Background jobs**
- `job:trust` nightly: recomputes trust scores and hides listings not
  confirmed for 90 days (they come back when the owner or an agent confirms)
- `job:weekly-ping` weekly: sends the WhatsApp check template to owners

Not in v1, by design (see the spec): premium listings and adverts (the
`subscriptions` and `adverts` tables exist, nothing uses them yet), payments,
bookings, other cities, native apps.

## Tech

- Next.js 15 (App Router, server components and server actions), TypeScript, Tailwind CSS 4
- PostgreSQL 16 with PostGIS (distance) and pg_trgm (typo-tolerant search)
- Plain SQL with `pg`; migrations in `db/migrations`, seed data in `db/seed`
- WhatsApp Cloud API (Meta) for the owner bot
- Vitest for tests

```
src/
  app/                 pages and API routes
    page.tsx           home
    search/            search results
    b/[slug]/          listing page, review and report forms
    markets/           market list and market pages
    add/               public "list your business" form
    admin/             team and field-agent tools
    api/contact/[id]   records a WhatsApp/call/directions tap, then redirects
    api/whatsapp       WhatsApp webhook
    api/admin/bot      bot test endpoint for /admin/bot
    uploads/[name]     serves uploaded photos
  lib/
    search.ts          the search query and ranking
    businesses.ts      listing reads, view counts, stats
    create-business.ts one place that creates listings (web, bot, agent)
    whatsapp/bot.ts    the bot conversation
    whatsapp/client.ts sending messages and downloading photos
    storage.ts         photo storage (local disk in v1)
    travel.ts          optional driving times from OSRM
  components/          shared UI
  proxy.ts             password protection for /admin
db/migrations/         schema, trust score function
db/seed/base.sql       Lagos areas, categories with Pidgin synonyms, markets
db/seed/demo.sql       sample listings for development only
scripts/               migrate, seed and the two jobs
tests/                 format helpers and full bot conversations
```

## Run it locally

You need Node 20+ and either Docker or a local PostgreSQL with PostGIS.

```bash
cp .env.example .env          # then edit ADMIN_PASSWORD at least
docker compose up -d          # PostGIS on localhost:5432
npm install
npm run db:migrate
npm run db:seed               # base data + sample listings
npm run dev                   # http://localhost:3000
```

Admin is at http://localhost:3000/admin (user and password from `.env`).
Try the bot at `/admin/bot`: send "Hi" and follow it.

Run the tests (they use the database in `DATABASE_URL` and clean up after themselves):

```bash
npm test
```

## Deploy

Any host that runs Node and PostgreSQL works. Two simple options:

- **A single VPS** (good value in Lagos-region clouds): install Docker, run
  PostGIS from `docker-compose.yml` or use a managed Postgres with PostGIS,
  then `docker build -t findam . && docker run -d -p 3000:3000 --env-file .env -v /srv/findam/uploads:/app/uploads findam`
  behind Caddy or Nginx for HTTPS.
- **Managed**: Render, Railway or Fly.io for the app, plus their Postgres (check
  PostGIS is available). Use persistent storage for `/app/uploads`, or swap
  `src/lib/storage.ts` for S3 or Cloudinary first.

On first deploy:

```bash
NODE_ENV=production npm run db:migrate
NODE_ENV=production npm run db:seed:base     # never the sample listings
```

Cron (server time UTC; Lagos is UTC+1):

```
0 1 * * *   cd /app && npm run job:trust          # 2am Lagos, nightly
0 8 * * 1   cd /app && npm run job:weekly-ping    # 9am Lagos, Mondays
```

Before launch, change `ADMIN_PASSWORD`, set `SITE_URL` to the real domain,
and set `WHATSAPP_APP_SECRET` (the webhook refuses unsigned requests in production).

## Set up the WhatsApp bot

1. Create a Meta Business account and an app with the WhatsApp product
   (developers.facebook.com). Add and verify a phone number for FindAm.
2. In the app's WhatsApp settings, copy the **phone number ID** and create a
   **permanent access token** (System User with `whatsapp_business_messaging`).
   Put them in `WHATSAPP_PHONE_NUMBER_ID` and `WHATSAPP_TOKEN`.
3. Copy the app secret into `WHATSAPP_APP_SECRET`.
4. Set the webhook URL to `https://YOUR_DOMAIN/api/whatsapp`, the verify token
   to the value of `WHATSAPP_VERIFY_TOKEN`, and subscribe to `messages`.
5. Create the weekly check **message template** named as in
   `WHATSAPP_PING_TEMPLATE` (default `weekly_check`), category Utility, with:
   - body: `Weekly check: is {{1}} still at the same place? {{2}} people viewed you and {{3}} chatted or called last week.`
   - two quick-reply buttons: `Yes, same place` and `We moved`

   Meta must approve it before the weekly job can send. Replies inside a
   conversation don't need templates; only this weekly message does.
6. Put the bot's public number in `WHATSAPP_DISPLAY_NUMBER` so the site shows
   "Send Hi on WhatsApp".

Without `WHATSAPP_TOKEN` the bot runs in dev mode: replies are logged, not sent.

## How the main rules work

- **Trust score** (0–100, `recompute_trust()` in `001_init.sql`): agent visit
  or CAC 40, number confirmed 20; freshness up to 30, falling to 0 at 90 days;
  reviews up to 20; recent contacts up to 10; minus 10 per open report.
- **Ranking**: trust, word match and closeness blended; an exact business name
  match comes first. "Nearest first" sorts purely by distance.
- **Open now**: an owner's OPEN/CLOSE counts for 16 hours, then the listing
  shows its usual hours instead.
- **Moving**: a MOVED update drops "Visited by FindAm agent" back to "Number
  confirmed" until an agent visits the new place.
- **Privacy**: the user's location is only used for that search and never
  stored. Reviews use an anonymous cookie, not an account.

## Before you scale

- Move photos to S3/Cloudinary (`src/lib/storage.ts`) before running more than one server.
- Replace the shared admin password with per-agent logins (phone + OTP).
- Add phone OTP for reviewers if fake reviews become a problem.
- Add rate limiting on the report and review forms.
- Area centre points in `db/seed/base.sql` are approximate; refine them with agents.
- When category synonyms change, re-save listings to refresh search text:
  `UPDATE businesses SET updated_at = now();`
