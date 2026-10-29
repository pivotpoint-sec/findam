// Driving time for the top few results, from an OSRM server (OSRM_URL).
// Without OSRM_URL the app shows straight-line distance only.
// Results are cached for 10 minutes to keep the routing server load low.

type Point = { lat: number; lng: number };
const cache = new Map<string, { at: number; secs: number | null }>();
const TTL_MS = 10 * 60 * 1000;

const key = (a: Point, b: Point) =>
  `${a.lat.toFixed(4)},${a.lng.toFixed(4)}>${b.lat.toFixed(4)},${b.lng.toFixed(4)}`;

/** Seconds of driving from `from` to each destination (null where unknown). */
export async function drivingTimes(from: Point, to: Point[]): Promise<(number | null)[]> {
  const base = process.env.OSRM_URL;
  if (!base || to.length === 0) return to.map(() => null);

  const now = Date.now();
  const out: (number | null)[] = to.map((p) => {
    const hit = cache.get(key(from, p));
    return hit && now - hit.at < TTL_MS ? hit.secs : null;
  });
  const missing = to.map((p, i) => ({ p, i })).filter(({ p }) => {
    const hit = cache.get(key(from, p));
    return !hit || now - hit.at >= TTL_MS;
  });
  if (missing.length === 0) return out;

  const coords = [from, ...missing.map((m) => m.p)].map((p) => `${p.lng},${p.lat}`).join(";");
  try {
    const res = await fetch(
      `${base.replace(/\/$/, "")}/table/v1/driving/${coords}?sources=0&annotations=duration`,
      { signal: AbortSignal.timeout(2500) },
    );
    if (!res.ok) return out;
    const json = (await res.json()) as { durations?: (number | null)[][] };
    const row = json.durations?.[0] ?? [];
    missing.forEach((m, j) => {
      const secs = row[j + 1] ?? null;
      cache.set(key(from, m.p), { at: now, secs });
      out[m.i] = secs;
    });
  } catch {
    // Routing is a nice-to-have; never fail the search because of it.
  }
  return out;
}

export function formatDrive(secs: number | null | undefined): string | null {
  if (secs == null) return null;
  const mins = Math.max(1, Math.round(secs / 60));
  return mins < 60 ? `${mins} min drive` : `${Math.floor(mins / 60)} h ${mins % 60} min drive`;
}
