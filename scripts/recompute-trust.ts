// Nightly job: recompute trust scores and hide listings unconfirmed for 90 days.
// Cron example (2am Lagos time):  0 1 * * *  cd /app && npm run job:trust
import "dotenv/config";
import { Client } from "pg";

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const { rows } = await client.query("SELECT * FROM recompute_trust()");
  await client.query("DELETE FROM bot_messages_seen WHERE seen_at < now() - interval '7 days'");
  console.log(`Trust scores updated: ${rows[0].updated}. Hidden as stale: ${rows[0].hidden}.`);
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
