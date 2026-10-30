import Link from "next/link";
import type { SearchResult } from "@/lib/search";
import { distance, priceRange } from "@/lib/format";
import { Icon } from "./Icon";
import { Confirmed, OpenStatus, VerifiedMark } from "./Status";

export function placeLine(b: Pick<SearchResult, "market" | "section" | "parent_section" | "shop_number" | "area">) {
  const parts = b.market
    ? [b.parent_section, b.section, b.shop_number ? `Shop ${b.shop_number}` : null, b.market]
    : [b.area];
  return parts.filter(Boolean).join(" · ");
}

export function BusinessCard({ b, travel }: { b: SearchResult; travel?: string | null }) {
  const where = b.comes_to_you
    ? b.covers_user_area
      ? "Comes to you · covers your area"
      : `Comes to you · based in ${b.area ?? "Lagos"}`
    : placeLine(b);

  return (
    <article className="card flex flex-col gap-3 p-4">
      <Link href={`/b/${b.slug}`} className="flex gap-3">
        {b.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={b.photo_url} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
        ) : (
          <div className="photo-placeholder h-16 w-16 shrink-0 rounded-xl" aria-hidden />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <h3 className="font-display text-[19px] font-extrabold leading-tight">{b.name}</h3>
            <VerifiedMark level={b.verification_level} />
          </div>
          <p className="text-[14px]">
            {b.distance_m != null ? <strong className="text-brand">{distance(b.distance_m)}</strong> : null}
            {b.distance_m != null && travel ? <span className="text-muted"> ({travel})</span> : null}
            {b.distance_m != null ? " · " : null}
            {where}
          </p>
          <p className="text-[13px] text-muted">
            {[
              b.verification_level === "none" ? "Unverified" : null,
              b.category,
              b.rating ? `${b.rating} from ${b.review_count} real customer${b.review_count === 1 ? "" : "s"}` : null,
              priceRange(b.price_min_ngn, b.price_max_ngn),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p className="flex flex-wrap gap-x-3 text-[13px]">
            <OpenStatus {...b} />
            <Confirmed at={b.last_confirmed_at} />
          </p>
        </div>
      </Link>
      {b.whatsapp ? (
        <a href={`/api/contact/${b.id}?channel=whatsapp`} className="btn btn-sun w-full" rel="nofollow">
          <Icon name="chat" size={18} /> Chat on WhatsApp
        </a>
      ) : b.phone ? (
        <a href={`/api/contact/${b.id}?channel=call`} className="btn btn-outline w-full" rel="nofollow">
          <Icon name="phone" size={18} /> Call
        </a>
      ) : null}
    </article>
  );
}
