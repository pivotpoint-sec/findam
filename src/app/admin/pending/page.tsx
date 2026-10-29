import Link from "next/link";
import { query } from "@/lib/db";
import { ago, displayPhone } from "@/lib/format";
import { approveListing, rejectListing } from "../actions";

export default async function PendingPage() {
  const rows = await query<{
    id: string; slug: string; name: string; category: string | null; area: string | null;
    landmark_directions: string | null; whatsapp: string | null; phone: string | null;
    created_at: string; source: string; photos: number; has_pin: boolean;
  }>(
    `SELECT b.id, b.slug, b.name, c.name AS category, a.name AS area, b.landmark_directions,
            b.whatsapp, b.phone, b.created_at, b.source,
            (SELECT count(*) FROM business_photos p WHERE p.business_id = b.id)::int AS photos,
            b.location IS NOT NULL AS has_pin
     FROM businesses b
     LEFT JOIN categories c ON c.id = b.category_id
     LEFT JOIN areas a ON a.id = b.area_id
     WHERE b.status = 'pending' ORDER BY b.created_at`,
  );

  return (
    <div className="flex flex-col gap-3">
      <h1 className="font-display text-[28px] font-extrabold">New listings</h1>
      <p className="text-[14px] text-muted">
        Submitted on the website. Check the number on WhatsApp before approving; send an agent to verify the strong ones.
      </p>
      {rows.length === 0 && <p className="card p-4 text-muted">Nothing waiting. Nice.</p>}
      {rows.map((b) => (
        <article key={b.id} className="card flex flex-col gap-2 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-bold">{b.name}</h2>
            <span className="text-[13px] text-muted">{ago(b.created_at)}</span>
          </div>
          <p className="text-[14px] text-muted">
            {[b.category, b.area, displayPhone(b.whatsapp || b.phone), `${b.photos} photo${b.photos === 1 ? "" : "s"}`, b.has_pin ? "map pin" : "no pin"]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {b.landmark_directions && <p className="text-[14px]">{b.landmark_directions}</p>}
          <div className="flex flex-wrap gap-2">
            <form action={approveListing}>
              <input type="hidden" name="id" value={b.id} />
              <button className="btn btn-primary">Approve</button>
            </form>
            <form action={rejectListing}>
              <input type="hidden" name="id" value={b.id} />
              <button className="btn btn-outline">Reject</button>
            </form>
            <Link href={`/admin/listings/${b.id}`} className="btn btn-outline">Edit</Link>
          </div>
        </article>
      ))}
    </div>
  );
}
