// The FindAm owner bot. Pure conversation logic: takes one incoming message,
// updates the database, and returns the replies to send. The webhook route
// sends them through WhatsApp; /admin/bot shows them in a test chat.
//
// What owners can do:
//   - list a business in a guided chat (name, category, shop or mobile, area,
//     map pin, landmark directions, photo)
//   - OPEN / CLOSE [reason]   set today's status
//   - YES / MOVED             answer the weekly "still there?" check
//   - STATS, LINK, NEW, MENU, STOP (no more weekly checks), CANCEL

import { query, queryOne } from "../db";
import { createBusiness, findByWhatsapp } from "../create-business";
import { weeklyStats } from "../businesses";
import type { Outgoing } from "./client";

export type Incoming = {
  from: string;                              // E.164
  text?: string;
  buttonId?: string;                         // interactive reply id
  location?: { lat: number; lng: number };
  photoUrl?: string | null;                  // already saved to storage
  hasImage?: boolean;                        // an image arrived (even if it couldn't be saved)
};

type Data = {
  name?: string;
  categoryId?: number;
  categoryName?: string;
  mobile?: boolean;
  areaId?: number;
  areaName?: string;
  serviceAreaIds?: number[];
  lat?: number;
  lng?: number;
  directions?: string;
  options?: number[];                        // ids behind a numbered list we sent
};

type State =
  | "idle"
  | "onb_name" | "onb_category" | "onb_kind" | "onb_area" | "onb_service_areas"
  | "onb_location" | "onb_directions" | "onb_photo"
  | "moved_location" | "moved_directions";

const text = (body: string): Outgoing => ({ type: "text", body });
const buttons = (body: string, b: { id: string; title: string }[]): Outgoing => ({ type: "buttons", body, buttons: b });

const site = () => (process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, "");
const link = (slug: string) => `${site()}/b/${slug}`;

// --- Session storage ------------------------------------------------------------

async function getSession(phone: string): Promise<{ state: State; data: Data }> {
  const row = await queryOne<{ state: State; data: Data; updated_at: string }>(
    "SELECT state, data, updated_at FROM bot_sessions WHERE phone = $1",
    [phone],
  );
  if (!row) return { state: "idle", data: {} };
  // An unfinished conversation older than a day starts over.
  if (row.state !== "idle" && Date.now() - new Date(row.updated_at).getTime() > 86_400_000) {
    return { state: "idle", data: {} };
  }
  return { state: row.state, data: row.data ?? {} };
}

async function setSession(phone: string, state: State, data: Data) {
  await query(
    `INSERT INTO bot_sessions (phone, state, data, updated_at) VALUES ($1, $2, $3, now())
     ON CONFLICT (phone) DO UPDATE SET state = $2, data = $3, updated_at = now()`,
    [phone, state, JSON.stringify(data)],
  );
}

// --- Owner lookup -----------------------------------------------------------------

type Owned = { id: string; name: string; slug: string; status: string };

async function ownedBusinesses(phone: string): Promise<Owned[]> {
  return query<Owned>(
    `SELECT b.id, b.name, b.slug, b.status FROM businesses b JOIN users u ON u.id = b.owner_id
     WHERE u.phone = $1 AND b.status IN ('live','hidden','pending') ORDER BY b.created_at`,
    [phone],
  );
}

/** A field agent may have listed this number already: link it to the owner. */
async function claimByNumber(phone: string): Promise<Owned | null> {
  const b = await findByWhatsapp(phone);
  if (!b || b.owner_id) return null;
  const u = await queryOne<{ id: string }>(
    `INSERT INTO users (phone, role) VALUES ($1, 'owner')
     ON CONFLICT (phone) DO UPDATE SET role = CASE WHEN users.role = 'user' THEN 'owner' ELSE users.role END
     RETURNING id`,
    [phone],
  );
  await query("UPDATE businesses SET owner_id = $1 WHERE id = $2", [u!.id, b.id]);
  return { id: b.id, name: b.name, slug: b.slug, status: b.status };
}

// --- Matching what people type ------------------------------------------------------

type Match = { id: number; name: string; score: number };

async function matchCategory(q: string): Promise<Match[]> {
  return query<Match>(
    `SELECT id, name, score FROM (
       SELECT c.id, c.name, greatest(
         word_similarity(lower(c.name), $1), similarity(lower(c.name), $1),
         coalesce((SELECT max(CASE WHEN length(s) <= 3
                                   THEN CASE WHEN $1 ~ ('\\m' || lower(s) || '\\M') THEN 1 ELSE 0 END
                                   ELSE greatest(word_similarity(lower(s), $1), similarity(lower(s), $1)) END)
                   FROM unnest(c.synonyms) s), 0)
       )::float AS score
       FROM categories c WHERE c.parent_id IS NOT NULL
     ) x ORDER BY score DESC, name LIMIT 3`,
    [q.toLowerCase()],
  );
}

async function matchArea(q: string): Promise<Match[]> {
  return query<Match>(
    `SELECT id, name, score FROM (
       SELECT a.id, a.name, greatest(
         similarity(lower(a.name), $1), word_similarity(lower(a.name), $1),
         coalesce((SELECT max(CASE WHEN length(x) <= 3
                                   THEN CASE WHEN $1 ~ ('\\m' || lower(x) || '\\M') THEN 1 ELSE 0 END
                                   ELSE greatest(similarity(lower(x), $1), word_similarity(lower(x), $1)) END)
                   FROM unnest(a.aliases) x), 0)
       )::float AS score
       FROM areas a
     ) y ORDER BY score DESC, name LIMIT 3`,
    [q.toLowerCase()],
  );
}

const confident = (m: Match[]) => m[0] && m[0].score >= 0.6 && (!m[1] || m[0].score - m[1].score >= 0.1 || m[0].score === 1);

async function allSubcategories() {
  return query<{ id: number; name: string; parent: string }>(
    `SELECT c.id, c.name, p.name AS parent FROM categories c JOIN categories p ON p.id = c.parent_id
     ORDER BY p.sort_order, c.sort_order`,
  );
}

async function allAreas() {
  return query<{ id: number; name: string }>("SELECT id, name FROM areas ORDER BY name");
}

/** "2" -> the id at position 2 of the list we last sent. */
function pickNumber(input: string, options?: number[]): number | null {
  if (!options?.length || !/^\d{1,2}$/.test(input.trim())) return null;
  const n = Number(input.trim());
  return n >= 1 && n <= options.length ? options[n - 1] : null;
}

// --- Messages ------------------------------------------------------------------------

const WELCOME =
  "Welcome to FindAm. Let's list your business free, in about 2 minutes.\n\nWhat's the name of your business?\n\n(Reply CANCEL any time to stop.)";

function ownerMenu(b: Owned[]): Outgoing {
  const name = b.length === 1 ? b[0].name : `${b[0].name} and ${b.length - 1} more`;
  return text(
    `Hi, this is FindAm for ${name}. Reply with:\n\n` +
      "OPEN - you're open now\n" +
      "CLOSE - closed today (add a reason, e.g. CLOSE light issue)\n" +
      "STATS - views and chats this week\n" +
      "LINK - your FindAm link to share\n" +
      "MOVED - you changed location\n" +
      "NEW - list another business\n" +
      "STOP - no more weekly check messages",
  );
}

const askLocation = (where: string) =>
  text(
    `Share your location pin so customers can see how far you are. Do this while you're at ${where}: ` +
      "tap the attach button (paperclip or +), choose Location, then Send your current location.\n\nNot there now? Reply SKIP.",
  );

const ASK_DIRECTIONS = text(
  'Now tell us how customers find you. Talk am like you dey direct person, e.g. "Opposite Mobil, enter the second street, blue gate".',
);

// --- The conversation -----------------------------------------------------------------

export async function handleIncoming(msg: Incoming): Promise<Outgoing[]> {
  const raw = (msg.text ?? "").trim();
  const word = raw.toLowerCase();
  const first = word.split(/\s+/)[0] ?? "";
  const { state, data } = await getSession(msg.from);

  // CANCEL (and STOP mid-conversation) always ends the current flow.
  if (state !== "idle" && (first === "cancel" || first === "stop")) {
    await setSession(msg.from, "idle", {});
    return [text("OK, stopped. Nothing was saved. Send HI any time to start again.")];
  }

  switch (state) {
    case "idle":
      return idle(msg, word, first);

    case "onb_name": {
      if (raw.length < 2 || raw.length > 80) return [text("Please send the business name (2 to 80 letters).")];
      await setSession(msg.from, "onb_category", { name: raw });
      return [text(`Nice one, ${raw}. What do you do? Type it in a few words, e.g. phone repair, buka, plumber, barber.`)];
    }

    case "onb_category": {
      const picked = pickNumber(raw, data.options);
      let cat: { id: number; name: string } | null = null;
      if (picked) {
        cat = (await queryOne<{ id: number; name: string }>("SELECT id, name FROM categories WHERE id = $1", [picked]));
      } else if (raw) {
        const m = await matchCategory(raw);
        if (confident(m)) cat = m[0];
      }
      if (!cat) {
        const all = await allSubcategories();
        await setSession(msg.from, "onb_category", { ...data, options: all.map((c) => c.id) });
        return [
          text(
            "Which of these fits best? Reply with the number.\n\n" +
              all.map((c, i) => `${i + 1}. ${c.name}`).join("\n"),
          ),
        ];
      }
      await setSession(msg.from, "onb_kind", { ...data, categoryId: cat.id, categoryName: cat.name, options: undefined });
      return [
        buttons(`Got it: ${cat.name}. Do customers come to you, or do you go to them?`, [
          { id: "kind_shop", title: "They come to me" },
          { id: "kind_mobile", title: "I go to them" },
        ]),
      ];
    }

    case "onb_kind": {
      const mobile = msg.buttonId === "kind_mobile" || /\b(go|mobile|house|home|them)\b/.test(word);
      const shop = msg.buttonId === "kind_shop" || /\b(shop|come|office|store)\b/.test(word);
      if (!mobile && !shop) {
        return [buttons("Please choose one:", [
          { id: "kind_shop", title: "They come to me" },
          { id: "kind_mobile", title: "I go to them" },
        ])];
      }
      await setSession(msg.from, "onb_area", { ...data, mobile });
      return [text(mobile
        ? "Which area of Lagos are you based in? e.g. Yaba, Surulere, Ikorodu"
        : "Which area of Lagos is your shop in? e.g. Ikeja, Yaba, Lekki Phase 1")];
    }

    case "onb_area": {
      const picked = pickNumber(raw, data.options);
      let area: { id: number; name: string } | null = null;
      if (picked) area = await queryOne("SELECT id, name FROM areas WHERE id = $1", [picked]);
      else if (raw) {
        const m = await matchArea(raw);
        if (confident(m)) area = m[0];
      }
      if (!area) {
        const all = await allAreas();
        await setSession(msg.from, "onb_area", { ...data, options: all.map((a) => a.id) });
        return [text("Which area? Reply with the number.\n\n" + all.map((a, i) => `${i + 1}. ${a.name}`).join("\n"))];
      }
      const next = { ...data, areaId: area.id, areaName: area.name, options: undefined };
      if (data.mobile) {
        await setSession(msg.from, "onb_service_areas", next);
        return [text(`${area.name}, noted. Which areas do you cover? Type them with commas, e.g. Yaba, Surulere, Ikeja. Or reply ALL for all of Lagos.`)];
      }
      await setSession(msg.from, "onb_location", next);
      return [askLocation("the shop")];
    }

    case "onb_service_areas": {
      let ids: number[] = [];
      if (/^all\b/.test(word)) ids = (await allAreas()).map((a) => a.id);
      else {
        for (const part of raw.split(/,|\band\b|\n/i).map((s) => s.trim()).filter(Boolean)) {
          const m = await matchArea(part);
          if (m[0] && m[0].score >= 0.5) ids.push(m[0].id);
        }
      }
      ids = [...new Set([data.areaId!, ...ids])];
      await setSession(msg.from, "onb_photo", { ...data, serviceAreaIds: ids });
      const names = await query<{ name: string }>("SELECT name FROM areas WHERE id = ANY ($1) ORDER BY name", [ids]);
      return [text(`You cover: ${names.map((n) => n.name).join(", ")}.\n\nLast step: send one photo of your work, so customers can see what you do. Or reply SKIP.`)];
    }

    case "onb_location": {
      if (msg.location) {
        if (!inLagos(msg.location)) return [text("That pin looks like it's outside Lagos. Try again from the shop, or reply SKIP.")];
        await setSession(msg.from, "onb_directions", { ...data, lat: msg.location.lat, lng: msg.location.lng });
        return [text("Pin saved."), ASK_DIRECTIONS];
      }
      if (first === "skip") {
        await setSession(msg.from, "onb_directions", data);
        return [ASK_DIRECTIONS];
      }
      return [askLocation("the shop")];
    }

    case "onb_directions": {
      if (raw.length < 10) return [text('Please give a bit more detail, e.g. "Second plaza after the Glo office, Line 2, Shop D47".')];
      await setSession(msg.from, "onb_photo", { ...data, directions: raw.slice(0, 400) });
      return [text("Last step: send one photo of your shop entrance, so customers know they're in the right place. Or reply SKIP.")];
    }

    case "onb_photo": {
      if (msg.hasImage && !msg.photoUrl) {
        return [text("Sorry, we couldn't save that photo. Try sending it again, or reply SKIP.")];
      }
      if (!msg.photoUrl && first !== "skip") {
        return [text("Send a photo, or reply SKIP to finish without one.")];
      }
      const created = await createBusiness(
        {
          name: data.name!,
          categoryId: data.categoryId!,
          areaId: data.areaId!,
          landmarkDirections: data.directions ?? null,
          lat: data.lat ?? null,
          lng: data.lng ?? null,
          whatsapp: msg.from,
          comesToYou: !!data.mobile,
          serviceAreaIds: data.serviceAreaIds ?? [],
          photos: msg.photoUrl ? [{ url: msg.photoUrl, kind: data.mobile ? "work" : "entrance" }] : [],
          ownerPhone: msg.from,
        },
        { source: "bot" },
      );
      await setSession(msg.from, "idle", {});
      return [
        text(
          `Your listing is live: ${link(created.slug)}\n\n` +
            "Customers will chat you on this WhatsApp number. Share the link with your customers too.\n\n" +
            "Reply OPEN or CLOSE any time to update your status, STATS to see how many people found you, or MENU for more.\n\n" +
            "A FindAm agent may visit to give you the Verified badge. It's free.",
        ),
      ];
    }

    case "moved_location": {
      if (msg.location) {
        if (!inLagos(msg.location)) return [text("That pin looks like it's outside Lagos. Try again, or reply SKIP.")];
        await setSession(msg.from, "moved_directions", { lat: msg.location.lat, lng: msg.location.lng });
        return [text("New pin saved."), ASK_DIRECTIONS];
      }
      if (first === "skip") {
        await setSession(msg.from, "moved_directions", {});
        return [ASK_DIRECTIONS];
      }
      return [askLocation("your new place")];
    }

    case "moved_directions": {
      if (raw.length < 10) return [text("Please give a bit more detail so customers can find the new place.")];
      const owned = await ownedBusinesses(msg.from);
      for (const b of owned) {
        await query(
          `UPDATE businesses SET landmark_directions = $2,
             location = CASE WHEN $3::float IS NULL THEN location ELSE ST_MakePoint($4, $3)::geography END,
             market_section_id = NULL, shop_number = NULL,
             -- an agent visit was for the old place
             verification_level = CASE WHEN verification_level = 'visited' THEN 'phone' ELSE verification_level END,
             last_confirmed_at = now(),
             status = CASE WHEN status = 'hidden' THEN 'live' ELSE status END
           WHERE id = $1`,
          [b.id, raw.slice(0, 400), data.lat ?? null, data.lng ?? null],
        );
      }
      await setSession(msg.from, "idle", {});
      return [text("Updated. Customers will now see your new location and directions.")];
    }
  }
}

async function idle(msg: Incoming, word: string, first: string): Promise<Outgoing[]> {
  let owned = await ownedBusinesses(msg.from);
  const claimed = owned.length === 0 ? await claimByNumber(msg.from) : null;
  if (claimed) owned = [claimed];

  if (owned.length === 0) {
    await setSession(msg.from, "onb_name", {});
    return [text(WELCOME)];
  }

  const intro: Outgoing[] = claimed
    ? [text(`We found ${claimed.name} on FindAm, listed by one of our agents. It's now linked to this WhatsApp number.`)]
    : [];
  const names = owned.map((b) => b.name).join(", ");
  const ids = owned.map((b) => b.id);

  const isYes = msg.buttonId === "ping_yes" || /^(yes|same|confirm|still here)\b/.test(word);
  const isMoved = msg.buttonId === "ping_moved" || first === "moved";

  if (first === "open") {
    await query(
      `UPDATE businesses SET is_open_now = TRUE, open_status_note = NULL, open_status_at = now(), last_confirmed_at = now(),
         status = CASE WHEN status = 'hidden' THEN 'live' ELSE status END
       WHERE id = ANY ($1)`,
      [ids],
    );
    return [...intro, text(`Done. ${names} shows as open now, for the next 16 hours.`)];
  }

  if (first === "close" || first === "closed") {
    const reason = (msg.text ?? "").trim().split(/\s+/).slice(1).join(" ").slice(0, 80) || null;
    await query(
      "UPDATE businesses SET is_open_now = FALSE, open_status_note = $2, open_status_at = now() WHERE id = ANY ($1)",
      [ids, reason],
    );
    return [...intro, text(`Done. ${names} shows as closed today${reason ? ` (${reason})` : ""}. Reply OPEN when you're back.`)];
  }

  if (isYes) {
    await query(
      `UPDATE businesses SET last_confirmed_at = now(), status = CASE WHEN status = 'hidden' THEN 'live' ELSE status END
       WHERE id = ANY ($1)`,
      [ids],
    );
    await query(
      "INSERT INTO verifications (business_id, method) SELECT unnest($1::uuid[]), 'owner_confirm'",
      [ids],
    );
    return [...intro, text(`Thank you. ${names} is confirmed at the same place.`)];
  }

  if (isMoved) {
    await setSession(msg.from, "moved_location", {});
    return [...intro, askLocation("your new place")];
  }

  if (first === "stats") {
    const lines = [];
    for (const b of owned) {
      const s = await weeklyStats(b.id);
      lines.push(`${b.name}: ${s.views} view${s.views === 1 ? "" : "s"}, ${s.contacts} chat${s.contacts === 1 ? "" : "s"} or call${s.contacts === 1 ? "" : "s"}`);
    }
    return [...intro, text(`Last 7 days on FindAm:\n\n${lines.join("\n")}`)];
  }

  if (first === "link") {
    return [...intro, text(owned.map((b) => `${b.name}: ${link(b.slug)}${b.status === "pending" ? " (waiting for review)" : ""}`).join("\n"))];
  }

  if (first === "new" || first === "add") {
    await setSession(msg.from, "onb_name", {});
    return [...intro, text("Let's list another business. What's its name?")];
  }

  if (first === "stop") {
    await query("UPDATE users SET pings_off = TRUE WHERE phone = $1", [msg.from]);
    return [...intro, text("OK, no more weekly check messages. Your listing stays up. Reply YES now and then to keep it showing as confirmed.")];
  }

  if (first === "start") {
    await query("UPDATE users SET pings_off = FALSE WHERE phone = $1", [msg.from]);
    return [...intro, text("Weekly check messages are back on.")];
  }

  return [...intro, ownerMenu(owned)];
}

function inLagos(p: { lat: number; lng: number }) {
  return p.lat > 6.2 && p.lat < 6.8 && p.lng > 2.7 && p.lng < 4.4;
}
