import Link from "next/link";
import { query } from "@/lib/db";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";
export const metadata = { title: "Lagos markets" };

export default async function MarketsPage() {
  const markets = await query<{ slug: string; name: string; description: string | null; area: string; shops: number }>(
    `SELECT m.slug, m.name, m.description, a.name AS area,
            (SELECT count(*) FROM businesses b JOIN market_sections s ON s.id = b.market_section_id
              WHERE s.market_id = m.id AND b.status = 'live')::int AS shops
     FROM markets m JOIN areas a ON a.id = m.area_id ORDER BY m.name`,
  );
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-[28px] font-extrabold">Inside the markets</h1>
        <p className="text-muted">Find a shop by street, plaza, line and shop number.</p>
      </div>
      {markets.map((m) => (
        <Link key={m.slug} href={`/markets/${m.slug}`} className="card flex items-center gap-3 p-4 hover:border-brand">
          <div className="flex-1">
            <p className="font-display text-xl font-extrabold">{m.name}</p>
            <p className="text-[14px] text-muted">
              {m.area}
              {m.description ? ` · ${m.description}` : ""}
            </p>
            <p className="mt-1 text-[13px] font-bold text-brand">
              {m.shops > 0 ? `${m.shops} shop${m.shops === 1 ? "" : "s"} listed` : "Being mapped now"}
            </p>
          </div>
          <Icon name="chevron" className="text-muted" />
        </Link>
      ))}
    </div>
  );
}
