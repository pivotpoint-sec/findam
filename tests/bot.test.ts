import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { handleIncoming } from "@/lib/whatsapp/bot";
import { pool, query, queryOne } from "@/lib/db";
import { searchBusinesses } from "@/lib/search";

const SHOP = "+2348099990101";
const MOBILE = "+2348099990102";
const AGENT_LISTED = "+2348099990103";

async function cleanup() {
  const phones = [SHOP, MOBILE, AGENT_LISTED];
  await query("DELETE FROM businesses WHERE whatsapp = ANY ($1)", [phones]);
  await query("DELETE FROM bot_sessions WHERE phone = ANY ($1)", [phones]);
  await query("DELETE FROM users WHERE phone = ANY ($1)", [phones]);
}

const say = async (from: string, text: string, extra: Partial<Parameters<typeof handleIncoming>[0]> = {}) => {
  const replies = await handleIncoming({ from, text, ...extra });
  return replies.map((r) => r.body).join("\n---\n");
};

beforeAll(cleanup);
afterAll(async () => {
  await cleanup();
  await pool.end();
});

describe("owner bot: shop listing", () => {
  it("walks a shop owner through listing", async () => {
    expect(await say(SHOP, "Hi")).toMatch(/name of your business/);
    expect(await say(SHOP, "Test Gadget Doctor")).toMatch(/What do you do/);
    // Category from Pidgin-ish free text
    const kind = await handleIncoming({ from: SHOP, text: "i dey repair phone screen" });
    expect(kind[0].body).toMatch(/Phone repair/);
    expect(kind[0].type).toBe("buttons");
    expect(await say(SHOP, "They come to me", { buttonId: "kind_shop" })).toMatch(/Which area/);
    expect(await say(SHOP, "ikeja")).toMatch(/location pin/);
    expect(await say(SHOP, "", { location: { lat: 6.5961, lng: 3.3431 } })).toMatch(/Pin saved/);
    expect(await say(SHOP, "short")).toMatch(/more detail/);
    expect(await say(SHOP, "Otigba Street, beside the Glo office, Line 2")).toMatch(/photo/);
    expect(await say(SHOP, "SKIP")).toMatch(/Your listing is live: .*\/b\/test-gadget-doctor/);

    const b = await queryOne<{ status: string; verification_level: string; comes_to_you: boolean; owner: string | null }>(
      `SELECT b.status, b.verification_level, b.comes_to_you, u.phone AS owner
       FROM businesses b LEFT JOIN users u ON u.id = b.owner_id WHERE b.whatsapp = $1`,
      [SHOP],
    );
    expect(b).toMatchObject({ status: "live", verification_level: "phone", comes_to_you: false, owner: SHOP });

    // And it is findable straight away, with distance from Computer Village
    const found = await searchBusinesses({ q: "gadget doctor", lat: 6.596, lng: 3.343 });
    expect(found.results[0]?.name).toBe("Test Gadget Doctor");
    expect(found.results[0]?.distance_m).toBeLessThan(100);
  });

  it("handles OPEN, CLOSE with a reason, STATS, YES and MOVED", async () => {
    expect(await say(SHOP, "open")).toMatch(/shows as open now/);
    expect(await say(SHOP, "CLOSE light issue")).toMatch(/closed today \(light issue\)/);
    const s = await queryOne<{ is_open_now: boolean; open_status_note: string }>(
      "SELECT is_open_now, open_status_note FROM businesses WHERE whatsapp = $1",
      [SHOP],
    );
    expect(s).toEqual({ is_open_now: false, open_status_note: "light issue" });

    expect(await say(SHOP, "stats")).toMatch(/Last 7 days/);
    expect(await say(SHOP, "Yes, same place", { buttonId: "ping_yes" })).toMatch(/confirmed at the same place/);

    expect(await say(SHOP, "We moved", { buttonId: "ping_moved" })).toMatch(/location pin/);
    expect(await say(SHOP, "skip")).toMatch(/how customers find you/);
    expect(await say(SHOP, "New shop: Pepple Street, Plaza B, first floor")).toMatch(/Updated/);
    const moved = await queryOne<{ landmark_directions: string }>(
      "SELECT landmark_directions FROM businesses WHERE whatsapp = $1",
      [SHOP],
    );
    expect(moved?.landmark_directions).toMatch(/Pepple Street/);

    expect(await say(SHOP, "what")).toMatch(/Reply with/);
  });

  it("lets owners cancel mid-flow", async () => {
    expect(await say(SHOP, "new")).toMatch(/list another business/);
    expect(await say(SHOP, "cancel")).toMatch(/stopped/);
    expect(await say(SHOP, "hello")).toMatch(/Reply with/);
  });
});

describe("owner bot: mobile artisan", () => {
  it("lists someone who goes to customers, with areas covered", async () => {
    await say(MOBILE, "hello");
    await say(MOBILE, "Test Cool Breeze AC");
    // "ac" is a short word: must match AC repair as a whole word
    const kind = await handleIncoming({ from: MOBILE, text: "AC repair and servicing" });
    expect(kind[0].body).toMatch(/AC repair/);
    expect(await say(MOBILE, "I go to them", { buttonId: "kind_mobile" })).toMatch(/based in/);
    expect(await say(MOBILE, "yaba")).toMatch(/Which areas do you cover/);
    expect(await say(MOBILE, "Surulere, Ikeja and Lekki 1")).toMatch(/Ikeja, Lekki Phase 1, Surulere, Yaba/);
    expect(await say(MOBILE, "skip")).toMatch(/Your listing is live/);

    const found = await searchBusinesses({ q: "ac", area: "surulere" });
    expect(found.results.map((r) => r.name)).toContain("Test Cool Breeze AC");
  });

  it("falls back to a numbered list when it can't tell the category", async () => {
    await say(MOBILE, "new");
    await say(MOBILE, "Test Mystery Biz");
    const list = await say(MOBILE, "qwxz");
    expect(list).toMatch(/Reply with the number/);
    expect(list).toMatch(/1\. Phone repair/);
    expect(await say(MOBILE, "1")).toMatch(/Got it: Phone repair/);
    await say(MOBILE, "cancel");
  });
});

describe("owner bot: claiming an agent-made listing", () => {
  it("links the listing when the owner first messages", async () => {
    await query(
      `INSERT INTO businesses (name, slug, category_id, area_id, whatsapp, status, verification_level, source)
       VALUES ('Test Agent Listed', 'test-agent-listed', (SELECT id FROM categories WHERE slug = 'barbers'),
               (SELECT id FROM areas WHERE slug = 'yaba'), $1, 'live', 'visited', 'agent')`,
      [AGENT_LISTED],
    );
    const reply = await say(AGENT_LISTED, "Hi");
    expect(reply).toMatch(/We found Test Agent Listed/);
    expect(await say(AGENT_LISTED, "link")).toMatch(/\/b\/test-agent-listed/);
  });
});
