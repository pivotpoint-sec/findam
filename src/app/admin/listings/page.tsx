import Link from "next/link";
import { query } from "@/lib/db";
import { ago } from "@/lib/format";
import { markVisited, setListingStatus } from "../actions";

type Props = { searchParams: Promise<{ q?: string; status?: string; source?: string; saved?: string }> };

export default async function ListingsPage({ searchParams }: Props) {
  const { q = "", status = "", source = "", saved } = await searchParams;
  const rows = await query<{
    id: string; slug: string; name: string; area: string | null; category: string | null; status: string;
    verification_level: string; trust_score: number; last_confirmed_at: string | null; source: string;
  }>(
    `SELECT b.id, b.slug, b.name, a.name AS area, c.name AS category, b.status, b.verification_level,
            b.trust_score::float AS trust_score, b.last_confirmed_at, b.source
     FROM businesses b
     LEFT JOIN areas a ON a.id = b.area_id
     LEFT JOIN categories c ON c.id = b.category_id
     WHERE ($1 = '' OR b.search_text ILIKE '%' || lower($1) || '%' OR b.whatsapp LIKE '%' || $1 || '%')
       AND ($2 = '' OR b.status = $2)
       AND ($3 = '' OR b.source = $3)
     ORDER BY b.created_at DESC LIMIT 200`,
    [q.trim(), status, source],
  );

  return (
    <div className="flex flex-col gap-3">
      <h1 className="font-display text-[28px] font-extrabold">All listings</h1>
      {saved && <p className="rounded-xl bg-brand-soft p-3 text-[14px] font-bold text-brand">Saved.</p>}
      <form className="flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Name, area, category or number" className="field min-h-11 flex-1" />
        <select name="status" defaultValue={status} className="field min-h-11 w-auto">
          <option value="">Any status</option>
          {["live", "pending", "hidden", "closed", "rejected", "removed"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select name="source" defaultValue={source} className="field min-h-11 w-auto">
          <option value="">Any source</option>
          {["web", "bot", "agent", "import"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button className="btn btn-primary">Filter</button>
      </form>
      <p className="text-[13px] text-muted">{rows.length} shown (newest first, up to 200)</p>
      {rows.map((b) => (
        <article key={b.id} className="card flex flex-col gap-2 p-3.5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <Link href={`/b/${b.slug}`} className="font-bold underline">{b.name}</Link>
            <span className="text-[13px] text-muted">
              {b.status} · {b.verification_level} · trust {Math.round(b.trust_score)} · via {b.source}
            </span>
          </div>
          <p className="text-[13px] text-muted">
            {[b.category, b.area, `confirmed ${ago(b.last_confirmed_at)}`].filter(Boolean).join(" · ")}
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href={`/admin/listings/${b.id}`} className="btn btn-outline min-h-10">Edit</Link>
            <form action={markVisited}>
              <input type="hidden" name="id" value={b.id} />
              <button className="btn btn-outline min-h-10">Mark visited</button>
            </form>
            <form action={setListingStatus} className="flex gap-2">
              <input type="hidden" name="id" value={b.id} />
              {b.status !== "live" && <button name="status" value="live" className="btn btn-outline min-h-10">Make live</button>}
              {b.status === "live" && <button name="status" value="hidden" className="btn btn-outline min-h-10">Hide</button>}
              {b.status !== "closed" && <button name="status" value="closed" className="btn btn-outline min-h-10">Closed</button>}
            </form>
          </div>
        </article>
      ))}
    </div>
  );
}
