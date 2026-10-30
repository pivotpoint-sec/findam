import Link from "next/link";
import { query } from "@/lib/db";
import { ago, displayPhone } from "@/lib/format";
import { resolveReport } from "../actions";

const REASONS: Record<string, string> = {
  closed: "Closed down",
  moved: "Moved",
  wrong_contact: "Wrong phone or WhatsApp",
  scam: "Scam or fake",
  other: "Something else",
  owner_removal: "Owner asks to remove listing",
};

export default async function ReportsPage() {
  const rows = await query<{
    id: string; reason: string; note: string | null; created_at: string; contact_phone: string | null;
    business_name: string; slug: string; business_id: string; others: number;
    listed_whatsapp: string | null; listed_phone: string | null;
  }>(
    `SELECT r.id, r.reason, r.note, r.created_at, r.contact_phone, b.name AS business_name, b.slug, b.id AS business_id,
            b.whatsapp AS listed_whatsapp, b.phone AS listed_phone,
            (SELECT count(*) FROM reports r2 WHERE r2.business_id = r.business_id AND NOT r2.resolved)::int AS others
     FROM reports r JOIN businesses b ON b.id = r.business_id
     WHERE NOT r.resolved
     ORDER BY (r.reason = 'owner_removal') DESC, (r.reason = 'scam') DESC, r.created_at`,
  );

  return (
    <div className="flex flex-col gap-3">
      <h1 className="font-display text-[28px] font-extrabold">Reports</h1>
      <p className="text-[14px] text-muted">
        Removal requests come first: data law expects us to act on them promptly. Call the number to confirm it&apos;s
        the owner, then remove.
      </p>
      {rows.length === 0 && <p className="card p-4 text-muted">No open reports.</p>}
      {rows.map((r) => {
        const removal = r.reason === "owner_removal";
        const listed = r.listed_whatsapp || r.listed_phone;
        return (
          <article
            key={r.id}
            className={`card flex flex-col gap-2 p-4 ${r.reason === "scam" || removal ? "border-alert" : ""}`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Link href={`/b/${r.slug}`} className="text-lg font-bold underline">{r.business_name}</Link>
              <span className="text-[13px] text-muted">{ago(r.created_at)}</span>
            </div>
            <p className="text-[14px]">
              <strong className={r.reason === "scam" || removal ? "text-alert" : ""}>{REASONS[r.reason] ?? r.reason}</strong>
              {r.note ? ` · ${r.note}` : ""}
              {r.others > 1 ? <span className="text-muted"> · {r.others} open reports on this listing</span> : null}
            </p>
            {removal && (
              <p className="text-[14px]">
                Call {displayPhone(r.contact_phone)}
                {listed
                  ? listed === r.contact_phone
                    ? " (same number as the listing)"
                    : ` · listing's number is ${displayPhone(listed)}`
                  : " · listing has no number"}
              </p>
            )}
            <form action={resolveReport} className="flex flex-wrap gap-2">
              <input type="hidden" name="id" value={r.id} />
              {removal ? (
                <>
                  <button name="outcome" value="remove" className="btn btn-primary">Confirmed: remove listing</button>
                  <button name="outcome" value="dismiss" className="btn btn-outline">Not the owner: dismiss</button>
                </>
              ) : (
                <>
                  <button name="outcome" value="dismiss" className="btn btn-outline">Dismiss</button>
                  <button name="outcome" value="hide" className="btn btn-outline">Hide listing</button>
                  <button name="outcome" value="close" className="btn btn-outline text-alert">Mark closed</button>
                </>
              )}
              <Link href={`/admin/listings/${r.business_id}`} className="btn btn-outline">Edit listing</Link>
            </form>
          </article>
        );
      })}
    </div>
  );
}
