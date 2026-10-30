// Applies db/migrations/*.sql in name order, once each.
import "dotenv/config";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";
import { databaseUrl } from "../src/lib/db-url";

async function main() {
  const client = new Client({ connectionString: databaseUrl() });
  await client.connect();
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);

  const dir = join(process.cwd(), "db", "migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const { rows } = await client.query<{ name: string }>("SELECT name FROM schema_migrations");
  const done = new Set(rows.map((r) => r.name));

  for (const file of files) {
    if (done.has(file)) continue;
    const sql = readFileSync(join(dir, file), "utf8");
    process.stdout.write(`Applying ${file} ... `);
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log("done");
    } catch (err) {
      await client.query("ROLLBACK");
      console.log("failed");
      throw err;
    }
  }
  console.log("Database is up to date.");
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
