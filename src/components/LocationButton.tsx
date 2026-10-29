"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Icon } from "./Icon";

/**
 * Asks the browser for the user's position (only when tapped, never on page
 * load) and reloads the search sorted by distance. The position is put in the
 * URL for this search only and is never stored by FindAm.
 */
export function LocationButton({ target = "/search", compact = false }: { target?: string; compact?: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [state, setState] = useState<"idle" | "busy" | "denied" | "unavailable">("idle");
  const active = params.has("lat") && params.has("lng");

  function locate() {
    if (!("geolocation" in navigator)) {
      setState("unavailable");
      return;
    }
    setState("busy");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = new URLSearchParams(params.toString());
        next.set("lat", pos.coords.latitude.toFixed(5));
        next.set("lng", pos.coords.longitude.toFixed(5));
        next.delete("area");
        next.delete("page");
        setState("idle");
        router.push(`${target}?${next.toString()}`);
      },
      (err) => setState(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable"),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );
  }

  function clear() {
    const next = new URLSearchParams(params.toString());
    next.delete("lat");
    next.delete("lng");
    router.push(`${target}?${next.toString()}`);
  }

  return (
    <div className="flex flex-col gap-1">
      {active ? (
        <button type="button" onClick={clear} className="chip is-on" aria-pressed="true">
          <Icon name="locate" size={16} /> Near you
        </button>
      ) : (
        <button type="button" onClick={locate} className="chip" disabled={state === "busy"}>
          <Icon name="locate" size={16} />
          {state === "busy" ? "Finding you…" : compact ? "Near me" : "Use my location"}
        </button>
      )}
      {state === "denied" && (
        <p className="text-[13px] text-muted">Location is off. Pick your area instead.</p>
      )}
      {state === "unavailable" && (
        <p className="text-[13px] text-muted">We couldn&apos;t get your location. Pick your area instead.</p>
      )}
    </div>
  );
}
