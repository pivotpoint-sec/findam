import Link from "next/link";
import { query } from "@/lib/db";
import { ago, displayPhone } from "@/lib/format";
import { approveClaim, rejectClaim } from "../actions";

// People saying "this is my business" from a number that isn't on the listing
// (claims from the listed WhatsApp number link instantly and never show here).
// Call the number, ask a question only the owner would know, then decide.
export default async function ClaimsPage() {
  const rows = await query<{
    id: string; phone: string; name: string | null; note: string | null; channel: string; created_at: string;
    business_id: string; business: string; slug: string; listed_whatsapp: string | null; listed_phone: string | null;
    source: string; owner_phone: string | null; area: string | null;
  }>(
    `SELECT c.id, c.phone, c.name, c.note, c.channel, c.created_at, b.id AS business_id, b.name AS business, b.slug,
            b.whatsapp AS listed_whatsapp, b.phone AS listed_phone, b.source, u.phone AS owner_phone, a.name AS area
     FROM claim_requests c
     JOIN businesses b ON b.id = c.business_id
     LEFT JOIN users u ON u.id = b.owner_id
     LEFT JOIN areas a ON a.id = b.area_id
     WHERE c.status = 'pending' ORDER BY c.created_at`,
  );

  return (
    <div className="flex flex-col gap-3">
      <h1 className="font-display text-[28px] font-extrabold">Claims</h1>
      <p className="text-[14px] text-muted">
        Call the claimer before approving. Ask something only the owner would know: what they sell, the shop
        number, the landmark outside. Approving links the listing to their number and marks it &quot;Number confirmed&quot;.
      </p>
      {rows.length === 0 && <p className="card p-4 text-muted">No claims waiting.</p>}
      {rows.map((c) => (
        <article key={c.id} className="card flex flex-col gap-2 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <Link href={`/b/${c.slug}`} className="text-lg font-bold underline">{c.business}</Link>
            <span className="text-[13px] text-muted">{ago(c.created_at)} · via {c.channel === "bot" ? "WhatsApp" : "website"}</span>
          </div>
          <p className="text-[14px]">
            Claimer: <strong>{c.name ? `${c.name}, ` : ""}{displayPhone(c.phone)}</strong>
          </p>
          <p className="text-[13px] text-muted">
            {[c.area, c.source === "import" ? "imported listing" : `added via ${c.source}`,
              c.listed_whatsapp || c.listed_phone ? `number on listing ${displayPhone(c.listed_whatsapp || c.listed_phone)}` : "no number on listing"]
              .filter(Boolean).join(" · ")}
          </p>
          {c.owner_phone && (
            <p className="rounded-lg bg-sun-soft p-2 text-[13px]">
              Already claimed by {displayPhone(c.owner_phone)}. Approving moves it to the new claimer.
            </p>
          )}
          {c.note && <p className="text-[14px]">{c.note}</p>}
          <div className="flex flex-wrap gap-2">
            <form action={approveClaim} className="flex flex-1 flex-wrap gap-2">
              <input type="hidden" name="id" value={c.id} />
              <input name="note" placeholder="How you confirmed (optional)" className="field min-h-11 flex-1" />
              <button className="btn btn-primary">Approve</button>
            </form>
            <form action={rejectClaim}>
              <input type="hidden" name="id" value={c.id} />
              <button className="btn btn-outline">Reject</button>
            </form>
          </div>
        </article>
      ))}
    </div>
  );
}
