import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getBusinessBySlug, getPhotos, getReviews, recordView } from "@/lib/businesses";
import { queryOne } from "@/lib/db";
import { readVisitorId } from "@/lib/visitor";
import { ago, displayPhone, naira, priceRange, whatsappLink } from "@/lib/format";
import { Icon, VerifiedTick } from "@/components/Icon";
import { Confirmed, OpenStatus, verificationLabel } from "@/components/Status";
import { DistanceFromYou } from "@/components/DistanceFromYou";
import { ReportForm, ReviewForm } from "./Forms";
import { ClaimCard, RemoveForm } from "./OwnerForms";
import { OSM_SOURCE } from "@/lib/osm-import";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const b = await getBusinessBySlug((await params).slug);
  if (!b) return { title: "Not found" };
  return {
    title: `${b.name}${b.area ? `, ${b.area}` : ""}`,
    description: b.description ?? `${b.category ?? "Business"} in ${b.area ?? "Lagos"} on FindAm`,
  };
}

export default async function ListingPage({ params }: Props) {
  const { slug } = await params;
  const b = await getBusinessBySlug(slug);
  if (!b || !["live", "hidden"].includes(b.status)) notFound();

  const visitorId = await readVisitorId();
  const [photos, reviews, canReview] = await Promise.all([
    getPhotos(b.id),
    getReviews(b.id),
    visitorId
      ? queryOne<{ ok: boolean }>(
          `SELECT EXISTS (SELECT 1 FROM contact_events e WHERE e.business_id = $1 AND e.visitor_id = $2
                          AND e.channel IN ('whatsapp','call'))
              AND NOT EXISTS (SELECT 1 FROM reviews r JOIN contact_events e ON e.id = r.contact_event_id
                              WHERE r.business_id = $1 AND e.visitor_id = $2) AS ok`,
          [b.id, visitorId],
        ).then((r) => !!r?.ok)
      : Promise.resolve(false),
    recordView(b.id),
  ]);

  const entrance = photos[0];
  const work = photos.slice(1);
  const verification = verificationLabel(b.verification_level);
  const strongVerified = b.verification_level === "visited" || b.verification_level === "cac";
  const unverified = b.verification_level === "none";
  const fromOsm = b.source === "import" && b.source_name === OSM_SOURCE;
  // Claim on WhatsApp: opens a chat with the FindAm bot, "CLAIM <slug>" typed in.
  const botNumber = process.env.WHATSAPP_DISPLAY_NUMBER;
  const claimHref = botNumber ? whatsappLink(botNumber, `CLAIM ${b.slug}`) : null;
  const marketCells = b.market
    ? [
        { k: "Market", v: b.market },
        { k: b.parent_section ? "Street" : "Section", v: b.parent_section ?? b.section },
        { k: "Line / plaza", v: b.parent_section ? b.section : null },
        { k: "Shop", v: b.shop_number },
      ].filter((c) => c.v)
    : [];

  return (
    <article className="-mx-4 -mt-5 flex flex-col">
      <div className="relative">
        {entrance ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={entrance.url} alt={`Entrance of ${b.name}`} className="h-56 w-full object-cover sm:h-72 sm:rounded-b-2xl" />
        ) : (
          <div className="photo-placeholder flex h-40 items-end p-4 sm:rounded-b-2xl">
            <span className="rounded-lg bg-ink/80 px-2.5 py-1 text-xs font-bold text-white">No entrance photo yet</span>
          </div>
        )}
        <Link
          href="/search"
          aria-label="Back to search"
          className="absolute left-4 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-white"
        >
          <Icon name="back" />
        </Link>
      </div>

      <div className="flex flex-col gap-5 px-4 pt-4">
        {b.status === "hidden" && (
          <p className="rounded-xl bg-sun-soft p-3 text-[14px]">
            This listing hasn&apos;t been confirmed for a while, so it may have moved or closed. Chat before you go.
          </p>
        )}

        <header className="flex flex-col gap-1.5">
          <h1 className="font-display text-[28px] font-extrabold leading-tight tracking-tight">{b.name}</h1>
          {b.description && <p className="text-[14px] text-muted">{b.description}</p>}
          <div className="mt-1 flex flex-wrap gap-2 text-[13px] font-bold">
            {verification && (
              <span
                className={`flex items-center gap-1.5 rounded-[10px] px-2.5 py-1.5 ${strongVerified ? "bg-brand-soft text-brand" : "bg-sand text-ink"}`}
              >
                {strongVerified && <VerifiedTick size={14} label="" />}
                {verification}
              </span>
            )}
            {unverified && (
              <span className="rounded-[10px] border border-line bg-white px-2.5 py-1.5 text-muted">Unverified</span>
            )}
            {!unverified || !fromOsm ? (
              <span className="flex flex-wrap gap-x-2 rounded-[10px] bg-sun-soft px-2.5 py-1.5">
                <OpenStatus {...b} />
                <span className="font-normal"><Confirmed at={b.last_confirmed_at} /></span>
              </span>
            ) : null}
          </div>
          {unverified && (
            <p className="text-[13px] text-muted">
              {fromOsm ? (
                <>
                  Details from{" "}
                  <a href="https://www.openstreetmap.org/copyright" className="underline" target="_blank" rel="noopener">
                    OpenStreetMap contributors
                  </a>
                  , not yet checked by FindAm. They may be out of date, so confirm before you go.
                </>
              ) : (
                "FindAm hasn't checked this business yet. Confirm details before you go."
              )}
            </p>
          )}
        </header>

        <div className="flex gap-2.5">
          {b.whatsapp && (
            <a href={`/api/contact/${b.id}?channel=whatsapp`} className="btn btn-sun min-h-[52px] flex-1 text-base" rel="nofollow">
              <Icon name="chat" /> Chat on WhatsApp
            </a>
          )}
          {(b.phone || b.whatsapp) && (
            <a
              href={`/api/contact/${b.id}?channel=call`}
              className={`btn btn-outline min-h-[52px] ${b.whatsapp ? "w-[52px] px-0" : "flex-1"}`}
              aria-label={`Call ${displayPhone(b.phone || b.whatsapp)}`}
              rel="nofollow"
            >
              <Icon name="phone" /> {b.whatsapp ? null : "Call"}
            </a>
          )}
        </div>

        {!b.claimed && <ClaimCard businessId={b.id} name={b.name} whatsappHref={claimHref} />}

        {(b.landmark_directions || b.street_address || b.market || b.comes_to_you || b.lat != null) && (
          <section className="card flex flex-col gap-2.5 p-4" aria-labelledby="find">
            <div className="flex items-baseline justify-between gap-2">
              <h2 id="find" className="label-caps">{b.comes_to_you ? "Where they work" : "How to find us"}</h2>
              {b.lat != null && b.lng != null && !b.comes_to_you && <DistanceFromYou lat={b.lat} lng={b.lng} />}
            </div>
            {b.comes_to_you && (
              <p className="text-base">
                Comes to you{b.service_areas.length ? ` in ${b.service_areas.join(", ")}` : ""}.
              </p>
            )}
            {b.landmark_directions && <p className="text-base leading-relaxed">{b.landmark_directions}</p>}
            {b.street_address && <p className="text-[14px] text-muted">{b.street_address}</p>}
            {!b.landmark_directions && !b.market && !b.comes_to_you && (
              <p className="text-[14px] text-muted">No landmark directions yet. Use the map pin, or chat them for directions.</p>
            )}
            {marketCells.length > 0 && (
              <dl className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {marketCells.map((c) => (
                  <div key={c.k} className="rounded-[10px] bg-sand p-2">
                    <dt className="text-[11px] text-muted">{c.k}</dt>
                    <dd className="text-[13px] font-bold">{c.v}</dd>
                  </div>
                ))}
              </dl>
            )}
            <div className="flex flex-wrap gap-2">
              {b.market_slug && (
                <Link href={`/markets/${b.market_slug}`} className="btn border border-brand text-brand">
                  See it on the market map
                </Link>
              )}
              {b.lat != null && !b.comes_to_you && (
                <a href={`/api/contact/${b.id}?channel=directions`} className="btn btn-outline" rel="nofollow">
                  <Icon name="map" size={18} /> Open in Maps
                </a>
              )}
            </div>
          </section>
        )}

        {(b.price_items.length > 0 || b.price_min_ngn != null) && (
          <section className="flex flex-col gap-1" aria-labelledby="prices">
            <h2 id="prices" className="label-caps mb-1">Price guide</h2>
            {b.price_items.length > 0 ? (
              b.price_items.map((p) => (
                <div key={p.label} className="flex justify-between border-b border-line py-2.5 last:border-0">
                  <span>{p.label}</span>
                  <span className="font-bold">{priceRange(p.min ?? null, p.max ?? null)}</span>
                </div>
              ))
            ) : (
              <p>
                Usually <strong>{priceRange(b.price_min_ngn, b.price_max_ngn)}</strong>
              </p>
            )}
          </section>
        )}

        {b.hours_note && (
          <section aria-labelledby="hours">
            <h2 id="hours" className="label-caps mb-1">Hours</h2>
            <p>{b.hours_note}</p>
          </section>
        )}

        {work.length > 0 && (
          <section aria-labelledby="photos">
            <h2 id="photos" className="label-caps mb-2">Photos</h2>
            <div className="grid grid-cols-3 gap-2">
              {work.map((p) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={p.id} src={p.url} alt={`Photo from ${b.name}`} className="aspect-square w-full rounded-xl object-cover" />
              ))}
            </div>
          </section>
        )}

        <section className="flex flex-col gap-2.5" aria-labelledby="reviews">
          <div className="flex items-baseline justify-between">
            <h2 id="reviews" className="label-caps">Reviews</h2>
            {b.review_count > 0 && (
              <span className="text-[13px] text-muted">
                {b.rating} · {b.review_count}, all from real contacts
              </span>
            )}
          </div>
          {reviews.length === 0 && (
            <p className="text-[14px] text-muted">
              No reviews yet. Only people who contact {b.name} through FindAm can review them.
            </p>
          )}
          {reviews.map((r) => (
            <div key={r.id} className="card flex flex-col gap-1 p-3.5">
              <span className="text-[14px] font-bold">
                {r.reviewer_name} · {"★".repeat(r.rating)}
                <span className="sr-only"> {r.rating} out of 5</span>
                <span className="font-normal text-muted"> · {ago(r.created_at)}</span>
              </span>
              {r.body && <p className="text-[14px] leading-relaxed">{r.body}</p>}
            </div>
          ))}
          {canReview && <ReviewForm businessId={b.id} slug={b.slug} />}
        </section>

        <div className="flex flex-col gap-1">
          <ReportForm businessId={b.id} />
          <RemoveForm businessId={b.id} />
        </div>

        <p className="pb-2 text-[12px] text-muted">
          Prices are a guide from the owner{b.price_min_ngn != null ? ` (from ${naira(b.price_min_ngn)})` : ""}. Always
          agree the price on WhatsApp before you go.
        </p>
      </div>
    </article>
  );
}
