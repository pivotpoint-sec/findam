// Loads base data (areas, categories, markets) and, unless --base-only is
// given, sample listings for development. Safe to run more than once.
import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";
import { databaseUrl } from "../src/lib/db-url";

async function main() {
  const baseOnly = process.argv.includes("--base-only");
  const client = new Client({ connectionString: databaseUrl() });
  await client.connect();
  const dir = join(process.cwd(), "db", "seed");

  console.log("Loading base data ...");
  await client.query(readFileSync(join(dir, "base.sql"), "utf8"));

  if (!baseOnly) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Refusing to load sample listings in production. Use --base-only.");
    }
    console.log("Loading sample listings ...");
    await client.query(readFileSync(join(dir, "demo.sql"), "utf8"));
  }

  const { rows } = await client.query("SELECT * FROM recompute_trust()");
  console.log(`Trust scores updated for ${rows[0].updated} listings.`);
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
