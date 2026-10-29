"use client";

import { useEffect, useState } from "react";
import { distance, walkTime } from "@/lib/format";

/**
 * Shows "350 m · about 5 min walk" on a listing, worked out in the browser.
 * It only runs if the user has already allowed location for this site, so a
 * listing page never pops up a permission prompt by itself.
 */
export function DistanceFromYou({ lat, lng }: { lat: number; lng: number }) {
  const [metres, setMetres] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!("geolocation" in navigator) || !navigator.permissions) return;
    navigator.permissions
      .query({ name: "geolocation" })
      .then((p) => {
        if (p.state !== "granted") return;
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (!cancelled) setMetres(haversine(pos.coords.latitude, pos.coords.longitude, lat, lng));
          },
          () => {},
          { maximumAge: 120_000, timeout: 8000 },
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [lat, lng]);

  if (metres == null) return null;
  const walk = walkTime(metres);
  return (
    <span className="text-[13px] font-bold text-brand">
      {distance(metres)}
      {walk ? ` · ${walk}` : " away"}
    </span>
  );
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
