import Link from "next/link";
import { queryOne, query } from "@/lib/db";

export default async function AdminHome() {
  const c = await queryOne<Record<string, number>>(
    `SELECT
       (SELECT count(*) FROM businesses WHERE status = 'live')::int AS live,
       (SELECT count(*) FROM businesses WHERE status = 'pending')::int AS pending,
       (SELECT count(*) FROM businesses WHERE status = 'hidden')::int AS hidden,
       (SELECT count(*) FROM businesses WHERE status = 'live' AND verification_level IN ('visited','cac'))::int AS verified,
       (SELECT count(*) FROM reports WHERE NOT resolved)::int AS reports,
       (SELECT count(*) FROM claim_requests WHERE status = 'pending')::int AS claims,
       (SELECT count(*) FROM businesses WHERE status = 'live' AND source = 'import' AND owner_id IS NULL)::int AS imported_unclaimed,
       (SELECT count(*) FROM businesses WHERE source = 'import' AND owner_id IS NOT NULL)::int AS imported_claimed,
       (SELECT count(*) FROM businesses WHERE status IN ('live','hidden')
          AND coalesce(last_confirmed_at, created_at) < now() - interval '60 days')::int AS stale,
       (SELECT count(*) FROM contact_events WHERE created_at > now() - interval '7 days')::int AS contacts_7d,
       (SELECT coalesce(sum(views), 0) FROM listing_views WHERE day > current_date - 7)::int AS views_7d,
       (SELECT count(*) FROM businesses WHERE status = 'live' AND last_confirmed_at > now() - interval '7 days')::int AS confirmed_7d`,
  );
  const byArea = await query<{ name: string; live: number; verified: number }>(
    `SELECT a.name,
            count(b.id) FILTER (WHERE b.status = 'live')::int AS live,
            count(b.id) FILTER (WHERE b.status = 'live' AND b.verification_level IN ('visited','cac'))::int AS verified
     FROM areas a LEFT JOIN businesses b ON b.area_id = a.id
     GROUP BY a.name ORDER BY live DESC, a.name`,
  );

  const tiles: { label: string; value: number; href?: string; note?: string }[] = [
    { label: "Live listings", value: c!.live, href: "/admin/listings" },
    { label: "Agent-verified", value: c!.verified },
    { label: "Waiting for review", value: c!.pending, href: "/admin/pending" },
    { label: "Open reports", value: c!.reports, href: "/admin/reports" },
    { label: "Claims to check", value: c!.claims, href: "/admin/claims" },
    { label: "Imported, not yet claimed", value: c!.imported_unclaimed, href: "/admin/listings?status=live&source=import" },
    { label: "Imported, claimed by owner", value: c!.imported_claimed, note: "How well imports convert" },
    { label: "Not confirmed 60+ days", value: c!.stale, href: "/admin/stale" },
    { label: "Hidden as stale", value: c!.hidden, href: "/admin/listings?status=hidden" },
    { label: "Listing views, 7 days", value: c!.views_7d },
    { label: "WhatsApp/call taps, 7 days", value: c!.contacts_7d, note: "Gate 2 target: 5,000 a week" },
    { label: "Confirmed this week", value: c!.confirmed_7d, note: "Gate 1: 30% of live" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-[28px] font-extrabold">Overview</h1>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {tiles.map((t) => {
          const inner = (
            <>
              <span className="text-[13px] text-muted">{t.label}</span>
              <span className="font-display text-[28px] font-extrabold">{t.value.toLocaleString("en-NG")}</span>
              {t.note && <span className="text-[12px] text-muted">{t.note}</span>}
            </>
          );
          return t.href ? (
            <Link key={t.label} href={t.href} className="card flex flex-col p-3.5 hover:border-brand">{inner}</Link>
          ) : (
            <div key={t.label} className="card flex flex-col p-3.5">{inner}</div>
          );
        })}
      </div>

      <section>
        <h2 className="label-caps mb-2">Coverage by area</h2>
        <div className="card overflow-x-auto">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="border-b border-line text-left text-muted">
                <th className="p-3 font-medium">Area</th>
                <th className="p-3 text-right font-medium">Live</th>
                <th className="p-3 text-right font-medium">Verified</th>
              </tr>
            </thead>
            <tbody>
              {byArea.map((a) => (
                <tr key={a.name} className="border-b border-line last:border-0">
                  <td className="p-3">{a.name}</td>
                  <td className="p-3 text-right">{a.live}</td>
                  <td className="p-3 text-right">{a.verified}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
