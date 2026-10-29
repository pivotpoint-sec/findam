// Weekly job: ask each owner "are you still at the same place?" using the
// approved WhatsApp template (WHATSAPP_PING_TEMPLATE), with last week's views
// and chats. Their button reply is handled by the bot (YES / MOVED).
//
// Template body example, three variables:
//   "Weekly check: is {{1}} still at the same place? {{2}} people viewed you
//    and {{3}} chatted or called last week."
// Quick-reply buttons: "Yes, same place", "We moved".
//
// Cron example (Monday 9am Lagos time):  0 8 * * 1  cd /app && npm run job:weekly-ping
import "dotenv/config";
import { pool, query } from "../src/lib/db";
import { weeklyStats } from "../src/lib/businesses";
import { sendTemplate, isLive } from "../src/lib/whatsapp/client";

async function main() {
  const template = process.env.WHATSAPP_PING_TEMPLATE || "weekly_check";
  const due = await query<{ id: string; name: string; phone: string }>(
    `SELECT DISTINCT ON (u.phone) b.id, b.name, u.phone
     FROM businesses b JOIN users u ON u.id = b.owner_id
     WHERE b.status IN ('live','hidden')
       AND NOT u.pings_off
       AND (b.last_pinged_at IS NULL OR b.last_pinged_at < now() - interval '6 days')
       AND (b.last_confirmed_at IS NULL OR b.last_confirmed_at < now() - interval '6 days')
     ORDER BY u.phone, b.created_at`,
  );

  console.log(`${due.length} owner(s) due a weekly check${isLive() ? "" : " (dev mode: not actually sending)"}.`);
  let sent = 0;
  for (const b of due) {
    try {
      const s = await weeklyStats(b.id);
      await sendTemplate(b.phone, template, [b.name, String(s.views), String(s.contacts)]);
      await query(
        `UPDATE businesses SET last_pinged_at = now()
         WHERE owner_id = (SELECT id FROM users WHERE phone = $1)`,
        [b.phone],
      );
      sent++;
      await new Promise((r) => setTimeout(r, 150)); // stay well under rate limits
    } catch (err) {
      console.error(`Failed for ${b.phone}:`, (err as Error).message);
    }
  }
  console.log(`Sent ${sent}.`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
