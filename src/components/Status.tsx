import { openState } from "@/lib/search";
import { ago } from "@/lib/format";
import { VerifiedTick } from "./Icon";

export function OpenStatus({
  is_open_now,
  open_status_at,
  open_status_note,
  hours_note,
}: {
  is_open_now: boolean | null;
  open_status_at: string | null;
  open_status_note?: string | null;
  hours_note?: string | null;
}) {
  const s = openState({ is_open_now, open_status_at });
  if (s === "open") return <span className="font-bold text-brand">Open now</span>;
  if (s === "closed")
    return (
      <span>
        <span className="font-bold text-alert">Closed today</span>
        {open_status_note ? <span className="text-muted"> · {open_status_note}</span> : null}
      </span>
    );
  return hours_note ? <span className="text-muted">{hours_note}</span> : null;
}

export function Confirmed({ at }: { at: string | null }) {
  if (!at) return <span className="text-muted">Not confirmed yet</span>;
  return <span className="text-muted">Confirmed {ago(at)}</span>;
}

export function verificationLabel(level: string): string | null {
  switch (level) {
    case "visited":
      return "Visited by FindAm agent";
    case "cac":
      return "Registered business, checked by FindAm";
    case "phone":
      return "Number confirmed";
    default:
      return null;
  }
}

export function VerifiedMark({ level }: { level: string }) {
  if (level !== "visited" && level !== "cac") return null;
  return <VerifiedTick label={verificationLabel(level) ?? "Verified"} />;
}
