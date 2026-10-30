import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pool, query, queryOne } from "@/lib/db";
import { categoryFor, importElements, mapElement, overpassQuery, type OsmElement } from "@/lib/osm-import";
import { handleIncoming } from "@/lib/whatsapp/bot";
import { searchBusinesses } from "@/lib/search";

const elements = (JSON.parse(readFileSync("tests/fixtures/osm-sample.json", "utf8")) as { elements: OsmElement[] }).elements;

// Test phone numbers, all in the +23480999905xx range used by the fixture.
const LISTED = "+2348099990501";   // the number on "Test OSM Phone Hub"
const STRANGER = "+2348099990599"; // someone else claiming it
const WA_LISTED = "+2348099990502"; // WhatsApp on "Test OSM Amala Spot"

async function cleanup() {
  await query("DELETE FROM businesses WHERE source_name = 'OpenStreetMap' AND source_ref LIKE '%/90000000%'");
  await query("DELETE FROM bot_sessions WHERE phone LIKE '+23480999905%'");
  await query("DELETE FROM users WHERE phone LIKE '+23480999905%'");
}

const say = async (from: string, text: string) =>
  (await handleIncoming({ from, text })).map((r) => r.body).join("\n---\n");

beforeAll(cleanup);
afterAll(async () => {
  await cleanup();
  await pool.end();
});

describe("OpenStreetMap mapping", () => {
  it("maps tags to FindAm categories", () => {
    expect(categoryFor({ shop: "mobile_phone" })).toBe("phone-repair");
    expect(categoryFor({ shop: "hairdresser", hairdresser: "barber" })).toBe("barbers");
    expect(categoryFor({ shop: "hairdresser", name: "Kings Barbing Salon" })).toBe("barbers");
    expect(categoryFor({ shop: "hairdresser" })).toBe("hair-salons");
    expect(categoryFor({ craft: "plumber" })).toBe("plumbing");
    expect(categoryFor({ amenity: "bank" })).toBeNull();
  });

  it("maps an element, using the centre of ways and only real WhatsApp tags", () => {
    const hub = mapElement(elements[0]);
    expect(hub).toMatchObject({ ref: "node/9000000001", phone: LISTED, whatsapp: null, streetAddress: "12 Allen Avenue" });
    const amala = mapElement(elements[1]);
    expect(amala).toMatchObject({ ref: "way/9000000002", lat: 6.5101, whatsapp: WA_LISTED, category: "restaurants" });
    expect(mapElement(elements[3])).toEqual({ skip: "no name" });
    expect(mapElement(elements[7])).toEqual({ skip: "closed" });
    // First valid Nigerian mobile from a list with a landline in it
    expect(mapElement(elements[8])).toMatchObject({ phone: "+2348099990509" });
  });

  it("builds an Overpass query for the Lagos State boundary, or a rectangle", () => {
    const q = overpassQuery();
    expect(q).toContain("[out:json]");
    expect(q).toContain('area["ISO3166-2"="NG-LA"]["boundary"="administrative"]->.lagos;');
    expect(q).toContain('node["shop"');
    expect(q).toContain("(area.lagos);");
    expect(q).toContain("out center tags");
    const box = overpassQuery({ bbox: [6.36, 2.7, 6.72, 4.36] });
    expect(box).toContain("(6.36,2.7,6.72,4.36);");
    expect(box).not.toContain("area.lagos");
  });
});

describe("importing", () => {
  it("dry run changes nothing", async () => {
    const s = await importElements(pool, elements, { dryRun: true });
    expect(s.created).toBe(5);
    const n = await queryOne<{ n: number }>("SELECT count(*)::int AS n FROM businesses WHERE source_ref LIKE '%/90000000%'");
    expect(n?.n).toBe(0);
  });

  it("imports unverified listings and skips what it should", async () => {
    const s = await importElements(pool, elements);
    expect(s).toMatchObject({ seen: 9, created: 5, updated: 0 });
    expect(s.skipped).toEqual({
      "no name": 1,
      "category not served": 1,
      "already on FindAm": 1, // Chidi Phone Clinic is already listed by an agent
      closed: 1,
    });
    // The tailor in Epe now has an area of its own
    const epe = await queryOne<{ area: string }>(
      "SELECT a.slug AS area FROM businesses b JOIN areas a ON a.id = b.area_id WHERE b.source_ref = 'node/9000000006'",
    );
    expect(epe?.area).toBe("epe");

    const hub = await queryOne<{ status: string; verification_level: string; source: string; slug: string; area: string; owner_id: string | null }>(
      `SELECT b.status, b.verification_level, b.source, b.slug, a.slug AS area, b.owner_id
       FROM businesses b JOIN areas a ON a.id = b.area_id WHERE b.source_ref = 'node/9000000001'`,
    );
    expect(hub).toEqual({ status: "live", verification_level: "none", source: "import", slug: "test-osm-phone-hub-ikeja", area: "ikeja", owner_id: null });
  });

  it("ranks imported listings below verified ones", async () => {
    const r = await searchBusinesses({ q: "phone", area: "ikeja" });
    const names = r.results.map((x) => x.name);
    expect(names.indexOf("Chidi Phone Clinic")).toBeLessThan(names.indexOf("Test OSM Phone Hub"));
    expect(r.results.find((x) => x.name === "Test OSM Phone Hub")?.verification_level).toBe("none");
  });

  it("is safe to run again, and moves unclaimed imports to their nearest area", async () => {
    await query("UPDATE businesses SET area_id = (SELECT id FROM areas WHERE slug = 'epe') WHERE source_ref = 'node/9000000001'");
    const s = await importElements(pool, elements);
    expect(s).toMatchObject({ created: 0, updated: 5 });
    const n = await queryOne<{ n: number }>("SELECT count(*)::int AS n FROM businesses WHERE source_ref LIKE '%/90000000%'");
    expect(n?.n).toBe(5);
    const hub = await queryOne<{ area: string; slug: string }>(
      "SELECT a.slug AS area, b.slug FROM businesses b JOIN areas a ON a.id = b.area_id WHERE b.source_ref = 'node/9000000001'",
    );
    // Area corrected, link unchanged
    expect(hub).toEqual({ area: "ikeja", slug: "test-osm-phone-hub-ikeja" });
  });

  it("still skips places too far from any area", async () => {
    const far: OsmElement = { type: "node", id: 9000000099, lat: 7.4, lon: 3.9, tags: { craft: "tailor", name: "Test OSM Ibadan Tailor" } };
    const s = await importElements(pool, [far], { dryRun: true });
    expect(s.skipped).toEqual({ "outside FindAm areas": 1 });
  });
});

describe("claiming on WhatsApp", () => {
  it("queues a claim from a number that isn't on the listing", async () => {
    const reply = await say(STRANGER, "CLAIM test-osm-phone-hub-ikeja");
    expect(reply).toMatch(/team member will call you/);
    // Asking twice doesn't create a second request
    await say(STRANGER, "CLAIM test-osm-phone-hub-ikeja");
    const c = await query("SELECT status FROM claim_requests WHERE phone = $1", [STRANGER]);
    expect(c).toEqual([{ status: "pending" }]);
    const b = await queryOne<{ owner_id: string | null }>("SELECT owner_id FROM businesses WHERE slug = 'test-osm-phone-hub-ikeja'");
    expect(b?.owner_id).toBeNull();
  });

  it("links straight away when the claim comes from the listed number", async () => {
    const reply = await say(LISTED, "claim https://findam.ng/b/test-osm-phone-hub-ikeja");
    expect(reply).toMatch(/is now yours on FindAm/);
    const b = await queryOne<{ owner: string; whatsapp: string; verification_level: string; last_confirmed: boolean }>(
      `SELECT u.phone AS owner, b.whatsapp, b.verification_level, b.last_confirmed_at IS NOT NULL AS last_confirmed
       FROM businesses b JOIN users u ON u.id = b.owner_id WHERE b.slug = 'test-osm-phone-hub-ikeja'`,
    );
    expect(b).toEqual({ owner: LISTED, whatsapp: LISTED, verification_level: "phone", last_confirmed: true });

    // Now it behaves like any owner: OPEN works
    expect(await say(LISTED, "open")).toMatch(/shows as open now/);
    // And it's already theirs if they claim again
    expect(await say(LISTED, "CLAIM test-osm-phone-hub-ikeja")).toMatch(/already linked to this number/);
  });

  it("tells a later claimer it's taken, and queues it for the team", async () => {
    expect(await say("+2348099990598", "CLAIM test-osm-phone-hub-ikeja")).toMatch(/already been claimed/);
  });

  it("links automatically when the owner just says hi from the listed WhatsApp number", async () => {
    expect(await say(WA_LISTED, "Hi")).toMatch(/We found Test OSM Amala Spot/);
  });

  it("handles a bad link", async () => {
    expect(await say(STRANGER, "CLAIM no-such-listing")).toMatch(/couldn't find that listing/);
  });

  it("never revives a removed listing on re-import", async () => {
    await query("UPDATE businesses SET status = 'removed' WHERE source_ref = 'node/9000000003'");
    const s = await importElements(pool, elements);
    expect(s.skipped["claimed or removed, left alone"]).toBe(3); // removed barber + 2 claimed
    const b = await queryOne<{ status: string }>("SELECT status FROM businesses WHERE source_ref = 'node/9000000003'");
    expect(b?.status).toBe("removed");
  });
});
