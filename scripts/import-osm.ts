// Imports Lagos businesses from OpenStreetMap as unverified, unclaimed listings.
//
//   npm run import:osm -- --dry-run          fetch and report, change nothing
//   npm run import:osm                       fetch and import
//   npm run import:osm -- --save osm.json    also keep the raw download
//   npm run import:osm -- --file osm.json    import from a saved download
//
// Safe to run again later: it refreshes unclaimed imported listings and adds
// new ones, and never touches listings that owners have claimed or removed.
import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import { Pool } from "pg";
import { databaseUrl } from "../src/lib/db-url";
import { importElements, overpassQuery, type OsmElement } from "../src/lib/osm-import";

const OVERPASS = process.env.OVERPASS_URL || "https://overpass-api.de/api/interpreter";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function download(): Promise<OsmElement[]> {
  console.log(`Downloading Lagos businesses from OpenStreetMap (${OVERPASS}) ...`);
  const res = await fetch(OVERPASS, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "FindAm-import/1.0" },
    body: new URLSearchParams({ data: overpassQuery() }),
    signal: AbortSignal.timeout(240_000),
  });
  if (!res.ok) throw new Error(`Overpass returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { elements: OsmElement[] };
  return json.elements;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const file = arg("--file");
  const save = arg("--save");

  const elements = file
    ? (JSON.parse(readFileSync(file, "utf8")) as { elements: OsmElement[] }).elements
    : await download();
  if (save) writeFileSync(save, JSON.stringify({ elements }));
  console.log(`${elements.length} places found.`);

  const pool = new Pool({ connectionString: databaseUrl() });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const s = await importElements(client, elements, { dryRun });
    if (dryRun) await client.query("ROLLBACK");
    else {
      await client.query("SELECT recompute_trust()");
      await client.query("COMMIT");
    }
    console.log(`${dryRun ? "[dry run] Would create" : "Created"} ${s.created}, ${dryRun ? "would refresh" : "refreshed"} ${s.updated}.`);
    const skipped = Object.entries(s.skipped).sort((a, b) => b[1] - a[1]);
    if (skipped.length) console.log("Skipped:\n" + skipped.map(([why, n]) => `  ${n}  ${why}`).join("\n"));
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
