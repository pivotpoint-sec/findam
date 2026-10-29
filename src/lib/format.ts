// Small display helpers shared by pages and the bot.

/** Normalise a Nigerian phone number to E.164 (+234...). Returns null if it isn't one. */
export function normalisePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  let digits = input.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("234")) digits = digits.slice(3);
  if (digits.startsWith("0")) digits = digits.slice(1);
  // Nigerian mobile numbers are 10 digits after the country code (e.g. 8012345678).
  if (!/^[789]\d{9}$/.test(digits)) return null;
  return `+234${digits}`;
}

/** "+2348012345678" -> "0801 234 5678" */
export function displayPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  const local = "0" + e164.replace(/^\+234/, "");
  return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
}

/** 15000 -> "₦15k", 1500 -> "₦1,500", 400000 -> "₦400k" */
export function naira(n: number | null | undefined): string {
  if (n == null) return "";
  if (n >= 1_000_000) return `₦${trim(n / 1_000_000)}m`;
  if (n >= 10_000) return `₦${trim(n / 1000)}k`;
  return `₦${n.toLocaleString("en-NG")}`;
}

function trim(x: number) {
  return Number.isInteger(x) ? String(x) : x.toFixed(1).replace(/\.0$/, "");
}

export function priceRange(min: number | null, max: number | null): string {
  if (min == null && max == null) return "";
  if (min != null && max != null && min !== max) return `${naira(min)}–${naira(max)}`;
  return naira(min ?? max);
}

/** 350 -> "350 m", 2430 -> "2.4 km" */
export function distance(metres: number | null | undefined): string {
  if (metres == null) return "";
  if (metres < 1000) return `${Math.max(10, Math.round(metres / 10) * 10)} m`;
  return `${(metres / 1000).toFixed(metres < 10_000 ? 1 : 0)} km`;
}

/** Rough walking time at 4.5 km/h, for short distances only. */
export function walkTime(metres: number): string | null {
  if (metres > 2500) return null;
  const mins = Math.max(1, Math.round(metres / 75));
  return `about ${mins} min walk`;
}

/** "today", "yesterday", "3 days ago", "5 weeks ago" */
export function ago(date: Date | string | null | undefined): string {
  if (!date) return "never";
  const d = typeof date === "string" ? new Date(date) : date;
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  return `${Math.round(days / 30)} months ago`;
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** wa.me link for a WhatsApp number, with a friendly opening message. */
export function whatsappLink(e164: string, text?: string): string {
  const digits = e164.replace(/\D/g, "");
  const q = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${digits}${q}`;
}
