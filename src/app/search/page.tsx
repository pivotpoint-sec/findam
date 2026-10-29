import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { searchBusinesses, type SearchParams } from "@/lib/search";
import { listAreas, listCategories } from "@/lib/businesses";
import { drivingTimes, formatDrive } from "@/lib/travel";
import { BusinessCard } from "@/components/BusinessCard";
import { SearchForm } from "@/components/SearchForm";
import { LocationButton } from "@/components/LocationButton";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";

type Raw = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export async function generateMetadata({ searchParams }: { searchParams: Promise<Raw> }): Promise<Metadata> {
  const q = one((await searchParams).q);
  return { title: q ? `${q} in Lagos` : "Search Lagos businesses" };
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<Raw> }) {
  const sp = await searchParams;
  const lat = Number(one(sp.lat));
  const lng = Number(one(sp.lng));
  const params: SearchParams = {
    q: one(sp.q),
    area: one(sp.area),
    category: one(sp.category),
    market: one(sp.market),
    lat: Number.isFinite(lat) && one(sp.lat) ? lat : undefined,
    lng: Number.isFinite(lng) && one(sp.lng) ? lng : undefined,
    verifiedOnly: one(sp.verified) === "1",
    openNow: one(sp.open) === "1",
    comesToYou: one(sp.ctu) === "1",
    sort: one(sp.sort) === "nearest" ? "nearest" : "best",
    page: Number(one(sp.page)) || 1,
  };

  const [areas, categories, outcome] = await Promise.all([
    listAreas(),
    listCategories(),
    searchBusinesses(params),
  ]);
  const { results, hasMore, origin, originArea } = outcome;

  // Driving time for the top 5 results over 800 m away, when we know where the
  // user is. Closer than that, people walk, so distance alone is enough.
  const travel: (string | null)[] = [];
  if (origin === "you" && params.lat != null && params.lng != null) {
    const needs = results
      .slice(0, 5)
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => r.distance_m != null && r.distance_m > 800 && r.lat != null && r.lng != null);
    const secs = await drivingTimes(
      { lat: params.lat, lng: params.lng },
      needs.map(({ r }) => ({ lat: r.lat!, lng: r.lng! })),
    );
    needs.forEach(({ i }, k) => (travel[i] = formatDrive(secs[k])));
  }

  const category = categories.find((c) => c.slug === params.category);
  const heading = params.q
    ? `“${params.q}”`
    : category
      ? category.name
      : params.market
        ? "Market shops"
        : "Businesses in Lagos";

  // Link that toggles one filter and keeps the rest.
  const toggle = (key: string, value = "1") => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      const s = one(v);
      if (s && k !== "page") next.set(k, s);
    }
    if (next.get(key) === value) next.delete(key);
    else next.set(key, value);
    return `/search?${next.toString()}`;
  };
  const pageLink = (n: number) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      const s = one(v);
      if (s) next.set(k, s);
    }
    next.set("page", String(n));
    return `/search?${next.toString()}`;
  };

  return (
    <div className="flex flex-col gap-4">
      <SearchForm
        areas={areas}
        q={params.q ?? ""}
        area={params.area ?? ""}
        hidden={{ category: params.category, market: params.market, lat: one(sp.lat), lng: one(sp.lng) }}
      />

      <div className="flex flex-wrap items-start gap-2" aria-label="Filters">
        <Suspense>
          <LocationButton compact />
        </Suspense>
        <Link href={toggle("verified")} className={`chip ${params.verifiedOnly ? "is-on" : ""}`} aria-pressed={params.verifiedOnly}>
          {params.verifiedOnly && <Icon name="check" size={14} strokeWidth={2.5} />} Verified only
        </Link>
        <Link href={toggle("open")} className={`chip ${params.openNow ? "is-on" : ""}`} aria-pressed={params.openNow}>
          Open now
        </Link>
        <Link href={toggle("ctu")} className={`chip ${params.comesToYou ? "is-on" : ""}`} aria-pressed={params.comesToYou}>
          Comes to you
        </Link>
        {origin && (
          <Link
            href={toggle("sort", "nearest")}
            className={`chip ${params.sort === "nearest" ? "is-on" : ""}`}
            aria-pressed={params.sort === "nearest"}
          >
            Nearest first
          </Link>
        )}
      </div>

      <div>
        <h1 className="font-display text-2xl font-extrabold">{heading}</h1>
        <p className="text-[13px] text-muted">
          {results.length === 0
            ? "No matches yet."
            : `${results.length}${hasMore ? "+" : ""} result${results.length === 1 ? "" : "s"} · ${
                origin === "you"
                  ? params.sort === "nearest" ? "nearest first from your location" : "best matches near you"
                  : origin === "area" && originArea
                    ? `in and around ${originArea.name}`
                    : "best matches across Lagos"
              }`}
        </p>
      </div>

      {results.length === 0 ? (
        <div className="card flex flex-col gap-2 p-5">
          <p className="font-bold">We no find am yet.</p>
          <p className="text-[14px] text-muted">
            Try fewer words, another area, or turn off filters. Know a good one? Tell them to list free on FindAm.
          </p>
          <Link href="/add" className="btn btn-outline mt-1 self-start">Add a business</Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {results.map((b, i) => (
            <BusinessCard key={b.id} b={b} travel={travel[i]} />
          ))}
        </div>
      )}

      {(params.page! > 1 || hasMore) && (
        <nav className="flex justify-between" aria-label="Pages">
          {params.page! > 1 ? <Link href={pageLink(params.page! - 1)} className="btn btn-outline">Previous</Link> : <span />}
          {hasMore ? <Link href={pageLink(params.page! + 1)} className="btn btn-outline">More results</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
