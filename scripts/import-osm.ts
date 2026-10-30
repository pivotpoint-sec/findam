// Imports Lagos businesses from OpenStreetMap as unverified, unclaimed listings.
//
//   npm run import:osm -- --dry-run          fetch and report, change nothing
//   npm run import:osm                       fetch and import
//   npm run import:osm -- --save osm.json    also keep the raw download
//   npm run import:osm -- --file osm.json    import from a saved download
//   npm run import:osm -- --bbox             search a rectangle round Lagos
//                                            instead of the state boundary
//
// Safe to run again later: it refreshes unclaimed imported listings and adds
// new ones, and never touches listings that owners have claimed or removed.
import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import { Pool } from "pg";
import { databaseUrl } from "../src/lib/db-url";
import { importElements, LAGOS_BBOX, overpassQuery, type OsmElement } from "../src/lib/osm-import";

// Public Overpass servers. They are free and often busy, so the import tries
// each in turn, a few times, before giving up. OVERPASS_URL uses only that one.
const SERVERS = process.env.OVERPASS_URL
  ? [process.env.OVERPASS_URL]
  : [
      "https://overpass-api.de/api/interpreter",
      "https://overpass.private.coffee/api/interpreter",
      "https://overpass.kumi.systems/api/interpreter",
    ];
const ROUNDS = 3;
// Busy or temporarily down: worth waiting and trying again.
const RETRYABLE = new Set([429, 502, 503, 504]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function download(useBbox: boolean): Promise<OsmElement[]> {
  const query = overpassQuery(useBbox ? { bbox: LAGOS_BBOX } : {});
  console.log(`Downloading Lagos businesses from OpenStreetMap${useBbox ? " (rectangle)" : ""} ...`);
  let lastError = "";

  for (let round = 1; round <= ROUNDS; round++) {
    for (const server of SERVERS) {
      const host = new URL(server).host;
      try {
        const res = await fetch(server, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "FindAm-import/1.0" },
          body: new URLSearchParams({ data: query }),
          signal: AbortSignal.timeout(330_000),
        });
        if (res.ok) {
          const json = (await res.json()) as { elements?: OsmElement[]; remark?: string };
          if (json.remark && !json.elements?.length) throw new Error(`Overpass: ${json.remark.slice(0, 200)}`);
          console.log(`Downloaded from ${host}.`);
          return json.elements ?? [];
        }
        lastError = `${host} returned ${res.status}`;
        if (!RETRYABLE.has(res.status)) throw new Error(`${lastError}: ${(await res.text()).slice(0, 300)}`);
        console.log(`  ${host} is busy (${res.status}), trying the next server ...`);
      } catch (err) {
        const e = err as Error;
        // A real error in the query itself won't fix itself on retry.
        if (/returned 4\d\d|Overpass:/.test(e.message) && !/returned 429/.test(e.message)) throw e;
        lastError = `${host}: ${e.name === "TimeoutError" ? "timed out" : e.message}`;
        console.log(`  ${lastError}, trying the next server ...`);
      }
    }
    if (round < ROUNDS) {
      const wait = 15 * 2 ** (round - 1);
      console.log(`All servers busy. Waiting ${wait} seconds before trying again (${round + 1} of ${ROUNDS}) ...`);
      await sleep(wait * 1000);
    }
  }
  throw new Error(`OpenStreetMap download failed after ${ROUNDS} rounds. Last error: ${lastError}. Try again later.`);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const file = arg("--file");
  const save = arg("--save");

  const useBbox = process.argv.includes("--bbox");
  const elements = file
    ? (JSON.parse(readFileSync(file, "utf8")) as { elements: OsmElement[] }).elements
    : await download(useBbox);
  if (!file && !useBbox && elements.length === 0) {
    console.log(
      "OpenStreetMap returned nothing for the Lagos State boundary. If that seems wrong, run again with --bbox " +
        "to search a rectangle around Lagos instead.",
    );
  }
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
