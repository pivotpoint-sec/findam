import Link from "next/link";
import { query } from "@/lib/db";
import { ago, displayPhone } from "@/lib/format";
import { markVisited } from "../actions";

// Listings nobody has confirmed for 60+ days, grouped by area, so agents can
// plan revisits. Hidden ones (90+ days) come back once confirmed.
export default async function StalePage() {
  const rows = await query<{
    id: string; slug: string; name: string; area: string | null; last_confirmed_at: string | null;
    status: string; whatsapp: string | null; landmark_directions: string | null; place: string | null;
  }>(
    `SELECT b.id, b.slug, b.name, a.name AS area, b.last_confirmed_at, b.status, b.whatsapp, b.landmark_directions,
            nullif(concat_ws(' · ', m.name, s.name, b.shop_number), '') AS place
     FROM businesses b
     LEFT JOIN areas a ON a.id = b.area_id
     LEFT JOIN market_sections s ON s.id = b.market_section_id
     LEFT JOIN markets m ON m.id = s.market_id
     WHERE b.status IN ('live','hidden') AND coalesce(b.last_confirmed_at, b.created_at) < now() - interval '60 days'
     ORDER BY a.name NULLS LAST, b.last_confirmed_at NULLS FIRST`,
  );
  const areas = [...new Set(rows.map((r) => r.area ?? "No area"))];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-[28px] font-extrabold">To revisit</h1>
        <p className="text-[14px] text-muted">Not confirmed for 60 days or more. Visit, or ask the owner to reply YES on WhatsApp.</p>
      </div>
      {rows.length === 0 && <p className="card p-4 text-muted">Everything is fresh.</p>}
      {areas.map((area) => (
        <section key={area} className="flex flex-col gap-2">
          <h2 className="label-caps">{area}</h2>
          {rows.filter((r) => (r.area ?? "No area") === area).map((b) => (
            <article key={b.id} className="card flex flex-col gap-1.5 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Link href={`/b/${b.slug}`} className="font-bold underline">{b.name}</Link>
                <span className="text-[13px] text-muted">
                  {b.status === "hidden" ? "Hidden · " : ""}confirmed {ago(b.last_confirmed_at)}
                </span>
              </div>
              <p className="text-[14px] text-muted">{[b.place, displayPhone(b.whatsapp)].filter(Boolean).join(" · ")}</p>
              {b.landmark_directions && <p className="text-[14px]">{b.landmark_directions}</p>}
              <form action={markVisited} className="flex flex-wrap gap-2 pt-1">
                <input type="hidden" name="id" value={b.id} />
                <input name="note" placeholder="Visit note (optional)" className="field min-h-11 flex-1" />
                <button className="btn btn-primary">Visited, still here</button>
              </form>
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}
