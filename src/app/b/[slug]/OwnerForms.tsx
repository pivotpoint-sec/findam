"use client";

import { useActionState, useState } from "react";
import { requestClaim, requestRemoval, type FormState } from "./actions";
import { Icon } from "@/components/Icon";

/**
 * "Is this your business?" card shown on unclaimed listings. WhatsApp is the
 * fast path (instant if the number matches); the web form is the fallback and
 * is always checked by the team.
 */
export function ClaimCard({
  businessId,
  name,
  whatsappHref,
}: {
  businessId: string;
  name: string;
  whatsappHref: string | null;
}) {
  const [showForm, setShowForm] = useState(!whatsappHref);
  const [state, action, pending] = useActionState<FormState, FormData>(requestClaim, {});

  return (
    <section className="card flex flex-col gap-3 border-brand p-4" aria-labelledby="claim">
      <div>
        <h2 id="claim" className="font-bold">Is this your business?</h2>
        <p className="text-[14px] text-muted">
          Claim it free to update your details, show when you&apos;re open and get the Verified badge.
        </p>
      </div>

      {whatsappHref && (
        <a href={whatsappHref} className="btn btn-sun self-start">
          <Icon name="chat" size={18} /> Claim it on WhatsApp
        </a>
      )}

      {state.ok ? (
        <p className="text-[14px] font-bold text-brand">
          Thanks. We&apos;ll call you within 2 days to confirm, then {name} will be linked to you.
        </p>
      ) : showForm ? (
        <form action={action} className="flex flex-col gap-2.5">
          <input type="hidden" name="businessId" value={businessId} />
          <label className="flex flex-col gap-1 text-[14px]">
            Your name
            <input name="name" className="field" maxLength={60} />
          </label>
          <label className="flex flex-col gap-1 text-[14px]">
            Phone number we can call
            <input name="phone" type="tel" inputMode="tel" className="field" required placeholder="0801 234 5678" />
          </label>
          {state.error && <p className="text-[14px] font-bold text-alert" role="alert">{state.error}</p>}
          <button className="btn btn-primary self-start" disabled={pending}>
            {pending ? "Sending…" : "Send claim"}
          </button>
        </form>
      ) : (
        <button type="button" onClick={() => setShowForm(true)} className="self-start text-[14px] underline">
          No WhatsApp? Claim with your phone number
        </button>
      )}
    </section>
  );
}

export function RemoveForm({ businessId }: { businessId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(requestRemoval, {});

  if (state.ok)
    return (
      <p className="text-[14px] font-bold text-brand">
        Got it. We&apos;ll call to confirm it&apos;s you, then take the listing down.
      </p>
    );
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="min-h-11 self-start text-[14px] text-muted underline">
        Own this business? Ask us to remove it
      </button>
    );

  return (
    <form action={action} className="card flex flex-col gap-3 p-4">
      <p className="font-bold">Remove this listing</p>
      <p className="text-[14px] text-muted">
        We&apos;ll call the number you give to confirm you own the business, then remove it and keep it off FindAm.
      </p>
      <input type="hidden" name="businessId" value={businessId} />
      <label className="flex flex-col gap-1 text-[14px]">
        Your name
        <input name="name" className="field" maxLength={60} />
      </label>
      <label className="flex flex-col gap-1 text-[14px]">
        Phone number we can call
        <input name="phone" type="tel" inputMode="tel" className="field" required />
      </label>
      <label className="flex flex-col gap-1 text-[14px]">
        Anything else? (optional)
        <textarea name="note" className="field min-h-20" maxLength={500} />
      </label>
      {state.error && <p className="text-[14px] font-bold text-alert" role="alert">{state.error}</p>}
      <div className="flex gap-2">
        <button className="btn btn-primary" disabled={pending}>{pending ? "Sending…" : "Send request"}</button>
        <button type="button" className="btn btn-outline" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}
