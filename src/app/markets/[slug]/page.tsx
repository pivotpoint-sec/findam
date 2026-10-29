import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { query, queryOne } from "@/lib/db";
import { openState } from "@/lib/search";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ q?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const m = await queryOne<{ name: string }>("SELECT name FROM markets WHERE slug = $1", [(await params).slug]);
  return { title: m ? `${m.name} shops` : "Market" };
}

type Section = { id: number; parent_id: number | null; name: string; kind: string };
type Shop = {
  slug: string; name: string; shop_number: string | null; section_id: number;
  is_open_now: boolean | null; open_status_at: string | null; last_confirmed_at: string | null;
};

export default async function MarketPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const q = ((await searchParams).q ?? "").trim();
  const market = await queryOne<{ id: number; name: string; area: string; description: string | null }>(
    `SELECT m.id, m.name, a.name AS area, m.description FROM markets m JOIN areas a ON a.id = m.area_id WHERE m.slug = $1`,
    [slug],
  );
  if (!market) notFound();

  const [sections, shops] = await Promise.all([
    query<Section>(
      "SELECT id, parent_id, name, kind FROM market_sections WHERE market_id = $1 ORDER BY parent_id NULLS FIRST, sort_order, name",
      [market.id],
    ),
    query<Shop>(
      `SELECT b.slug, b.name, b.shop_number, b.market_section_id AS section_id,
              b.is_open_now, b.open_status_at, b.last_confirmed_at
       FROM businesses b JOIN market_sections s ON s.id = b.market_section_id
       WHERE s.market_id = $1 AND b.status IN ('live','hidden')
         AND ($2 = '' OR b.search_text ILIKE '%' || lower($2) || '%' OR lower(b.shop_number) = lower($2))
       ORDER BY b.shop_number NULLS LAST, b.name`,
      [market.id, q],
    ),
  ]);

  const top = sections.filter((s) => s.parent_id == null);
  const childrenOf = (id: number) => sections.filter((s) => s.parent_id === id);
  const shopsIn = (id: number) => shops.filter((s) => s.section_id === id);
  const countUnder = (id: number) => shopsIn(id).length + childrenOf(id).reduce((n, c) => n + shopsIn(c.id).length, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Link href="/markets" aria-label="All markets" className="btn btn-outline h-11 w-11 rounded-full px-0">
          <Icon name="back" />
        </Link>
        <div>
          <h1 className="font-display text-[24px] font-extrabold leading-tight">{market.name}</h1>
          <p className="text-[13px] text-muted">
            {market.area}
            {market.description ? ` · ${market.description}` : ""}
          </p>
        </div>
      </div>

      <form method="get" role="search" className="card flex min-h-12 items-center gap-2.5 px-3.5">
        <label htmlFor="mq" className="sr-only">Search inside {market.name}</label>
        <Icon name="search" />
        <input
          id="mq"
          name="q"
          defaultValue={q}
          placeholder="Shop number, name or what they sell"
          className="min-w-0 flex-1 bg-transparent py-3 text-base outline-none"
        />
      </form>

      {top.length === 0 && <p className="text-muted">This market is being mapped. Check back soon.</p>}

      {top.map((street) => {
        const lines = childrenOf(street.id);
        const direct = shopsIn(street.id);
        const total = countUnder(street.id);
        if (q && total === 0) return null;
        return (
          <section key={street.id} className="card overflow-hidden">
            <div className="flex items-center justify-between bg-brand px-4 py-3.5 text-white">
              <h2 className="text-base font-bold">{street.name}</h2>
              <span className="text-[13px] text-[#d7ebdf]">{total} shop{total === 1 ? "" : "s"}</span>
            </div>
            <div className="flex flex-col px-4 pb-3 pt-1">
              {direct.map((s) => <ShopRow key={s.slug} s={s} />)}
              {lines.map((line) => {
                const list = shopsIn(line.id);
                if (q && list.length === 0) return null;
                return (
                  <div key={line.id}>
                    <h3 className="label-caps pb-1.5 pt-3 !text-xs">{line.name}</h3>
                    {list.length === 0 && <p className="py-2 text-[14px] text-muted">No shops listed yet</p>}
                    {list.map((s) => <ShopRow key={s.slug} s={s} />)}
                  </div>
                );
              })}
              {direct.length === 0 && lines.length === 0 && (
                <p className="py-2 text-[14px] text-muted">No shops listed yet</p>
              )}
            </div>
          </section>
        );
      })}

      {q && shops.length === 0 && (
        <p className="text-muted">No shop matches &quot;{q}&quot; yet.</p>
      )}
    </div>
  );
}

function ShopRow({ s }: { s: Shop }) {
  const state = openState(s);
  return (
    <Link href={`/b/${s.slug}`} className="flex min-h-[52px] items-center gap-3 border-b border-[#efe9d9] last:border-0">
      <span className="w-12 font-display font-extrabold text-brand">{s.shop_number ?? "–"}</span>
      <span className="flex-1 font-bold">{s.name}</span>
      <span
        className={`text-xs font-bold ${state === "open" ? "text-brand" : state === "closed" ? "text-alert" : "text-muted"}`}
      >
        {state === "open" ? "Open" : state === "closed" ? "Closed" : s.last_confirmed_at ? "Hours vary" : "Not confirmed"}
      </span>
    </Link>
  );
}
