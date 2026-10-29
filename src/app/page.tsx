import Link from "next/link";
import { Suspense } from "react";
import { query } from "@/lib/db";
import { listAreas } from "@/lib/businesses";
import { SearchForm } from "@/components/SearchForm";
import { LocationButton } from "@/components/LocationButton";
import { Icon, type IconName } from "@/components/Icon";
import { placeLine } from "@/components/BusinessCard";

export const dynamic = "force-dynamic";

const POPULAR: { label: string; category: string; icon: IconName }[] = [
  { label: "Phone repair", category: "phone-repair", icon: "mobile" },
  { label: "Home artisans", category: "home-artisans", icon: "tools" },
  { label: "Food and bukas", category: "food", icon: "food" },
  { label: "Salons and barbers", category: "beauty", icon: "scissors" },
  { label: "Mechanics", category: "auto", icon: "car" },
  { label: "Tailors", category: "fashion", icon: "shirt" },
];

export default async function Home() {
  const [areas, recent] = await Promise.all([
    listAreas(),
    query<{
      slug: string; name: string; area: string | null; market: string | null; section: string | null;
      parent_section: string | null; shop_number: string | null; comes_to_you: boolean;
    }>(
      `SELECT b.slug, b.name, ar.name AS area, m.name AS market, s.name AS section,
              ps.name AS parent_section, b.shop_number, b.comes_to_you
       FROM businesses b
       LEFT JOIN areas ar ON ar.id = b.area_id
       LEFT JOIN market_sections s ON s.id = b.market_section_id
       LEFT JOIN market_sections ps ON ps.id = s.parent_id
       LEFT JOIN markets m ON m.id = s.market_id
       WHERE b.status = 'live' AND b.last_confirmed_at > now() - interval '7 days'
       ORDER BY b.trust_score DESC LIMIT 4`,
    ),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-1.5">
        <h1 className="font-display text-[32px] font-extrabold leading-[1.05] tracking-tight sm:text-[40px]">
          Wetin you dey find today?
        </h1>
        <p className="text-muted">
          Verified businesses across Lagos, from Ikorodu to Lekki. Even the ones without an address.
        </p>
      </section>

      <div className="flex flex-col gap-2">
        <SearchForm areas={areas} />
        <Suspense>
          <LocationButton />
        </Suspense>
      </div>

      <section className="flex flex-col gap-2.5" aria-labelledby="popular">
        <h2 id="popular" className="label-caps">Popular now</h2>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {POPULAR.map((p) => (
            <Link
              key={p.category}
              href={`/search?category=${p.category}`}
              className="card flex min-h-[92px] flex-col items-start gap-2.5 p-3.5 hover:border-brand"
            >
              <Icon name={p.icon} size={24} className="text-brand" />
              <span className="font-bold">{p.label}</span>
            </Link>
          ))}
        </div>
      </section>

      <Link
        href="/markets/computer-village"
        className="flex items-center gap-3.5 rounded-[18px] bg-brand p-4 text-white hover:bg-brand-dark"
      >
        <div className="flex flex-1 flex-col gap-1">
          <span className="text-xs font-bold uppercase tracking-wider text-sun">Inside the market</span>
          <span className="font-display text-[21px] font-extrabold leading-tight">
            Find any shop in Computer Village
          </span>
          <span className="text-sm text-[#d7ebdf]">Search by street, plaza, line and shop number</span>
        </div>
        <Icon name="chevron" size={22} />
      </Link>

      {recent.length > 0 && (
        <section className="flex flex-col gap-2.5" aria-labelledby="recent">
          <h2 id="recent" className="label-caps">Confirmed open this week</h2>
          {recent.map((b) => (
            <Link key={b.slug} href={`/b/${b.slug}`} className="card flex items-center gap-3 p-3 hover:border-brand">
              <div className="photo-placeholder h-12 w-12 shrink-0 rounded-[10px]" aria-hidden />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="font-bold">{b.name}</span>
                <span className="truncate text-[13px] text-muted">
                  {b.comes_to_you ? `Comes to you · ${b.area}` : placeLine(b)}
                </span>
              </div>
              <Icon name="chevron" size={18} className="text-muted" />
            </Link>
          ))}
        </section>
      )}

      <Link href="/add" className="card flex items-center justify-between gap-3 p-4 hover:border-brand">
        <div>
          <p className="font-bold">Own a business in Lagos?</p>
          <p className="text-[14px] text-muted">List it free in 2 minutes, or send &quot;Hi&quot; to our WhatsApp.</p>
        </div>
        <Icon name="chevron" className="text-muted" />
      </Link>
    </div>
  );
}
