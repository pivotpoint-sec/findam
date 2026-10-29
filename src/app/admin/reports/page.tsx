import Link from "next/link";
import { query } from "@/lib/db";
import { ago } from "@/lib/format";
import { resolveReport } from "../actions";

const REASONS: Record<string, string> = {
  closed: "Closed down",
  moved: "Moved",
  wrong_contact: "Wrong phone or WhatsApp",
  scam: "Scam or fake",
  other: "Something else",
};

export default async function ReportsPage() {
  const rows = await query<{
    id: string; reason: string; note: string | null; created_at: string;
    business_name: string; slug: string; business_id: string; others: number;
  }>(
    `SELECT r.id, r.reason, r.note, r.created_at, b.name AS business_name, b.slug, b.id AS business_id,
            (SELECT count(*) FROM reports r2 WHERE r2.business_id = r.business_id AND NOT r2.resolved)::int AS others
     FROM reports r JOIN businesses b ON b.id = r.business_id
     WHERE NOT r.resolved ORDER BY (r.reason = 'scam') DESC, r.created_at`,
  );

  return (
    <div className="flex flex-col gap-3">
      <h1 className="font-display text-[28px] font-extrabold">Reports</h1>
      {rows.length === 0 && <p className="card p-4 text-muted">No open reports.</p>}
      {rows.map((r) => (
        <article key={r.id} className={`card flex flex-col gap-2 p-4 ${r.reason === "scam" ? "border-alert" : ""}`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <Link href={`/b/${r.slug}`} className="text-lg font-bold underline">{r.business_name}</Link>
            <span className="text-[13px] text-muted">{ago(r.created_at)}</span>
          </div>
          <p className="text-[14px]">
            <strong className={r.reason === "scam" ? "text-alert" : ""}>{REASONS[r.reason]}</strong>
            {r.note ? ` · ${r.note}` : ""}
            {r.others > 1 ? <span className="text-muted"> · {r.others} open reports on this listing</span> : null}
          </p>
          <form action={resolveReport} className="flex flex-wrap gap-2">
            <input type="hidden" name="id" value={r.id} />
            <button name="outcome" value="dismiss" className="btn btn-outline">Dismiss</button>
            <button name="outcome" value="hide" className="btn btn-outline">Hide listing</button>
            <button name="outcome" value="close" className="btn btn-outline text-alert">Mark closed</button>
            <Link href={`/admin/listings/${r.business_id}`} className="btn btn-outline">Edit listing</Link>
          </form>
        </article>
      ))}
    </div>
  );
}
