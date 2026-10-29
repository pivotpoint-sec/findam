"use client";

import { useActionState, useState } from "react";
import { submitReport, submitReview, type FormState } from "./actions";

export function ReviewForm({ businessId, slug }: { businessId: string; slug: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(submitReview, {});
  if (state.ok) return <p className="card p-4 font-bold text-brand">Thank you. Your review is up.</p>;

  return (
    <form action={action} className="card flex flex-col gap-3 p-4">
      <p className="font-bold">How did it go?</p>
      <input type="hidden" name="businessId" value={businessId} />
      <input type="hidden" name="slug" value={slug} />
      <fieldset className="flex gap-2">
        <legend className="mb-1.5 text-[14px] text-muted">Your rating</legend>
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="chip cursor-pointer has-[:checked]:border-brand has-[:checked]:bg-brand has-[:checked]:text-white">
            <input type="radio" name="rating" value={n} className="sr-only" required />
            {n}
          </label>
        ))}
      </fieldset>
      <label className="flex flex-col gap-1 text-[14px]">
        First name
        <input name="name" className="field" maxLength={40} required />
      </label>
      <label className="flex flex-col gap-1 text-[14px]">
        What happened? (optional)
        <textarea name="body" className="field min-h-24" maxLength={600} />
      </label>
      {state.error && <p className="text-[14px] font-bold text-alert" role="alert">{state.error}</p>}
      <button className="btn btn-primary self-start" disabled={pending}>
        {pending ? "Sending…" : "Post review"}
      </button>
    </form>
  );
}

export function ReportForm({ businessId }: { businessId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(submitReport, {});

  if (state.ok) return <p className="text-[14px] font-bold text-brand">Thanks, we&apos;ll check it.</p>;
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="min-h-11 self-start text-[14px] font-bold text-alert">
        Report a problem with this listing
      </button>
    );

  return (
    <form action={action} className="card flex flex-col gap-3 p-4">
      <input type="hidden" name="businessId" value={businessId} />
      <label className="flex flex-col gap-1 text-[14px]">
        What&apos;s wrong?
        <select name="reason" className="field" required defaultValue="">
          <option value="" disabled>Choose one</option>
          <option value="closed">They have closed down</option>
          <option value="moved">They have moved</option>
          <option value="wrong_contact">Wrong phone or WhatsApp</option>
          <option value="scam">Scam or fake listing</option>
          <option value="other">Something else</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[14px]">
        Details (optional)
        <textarea name="note" className="field min-h-20" maxLength={500} />
      </label>
      {state.error && <p className="text-[14px] font-bold text-alert" role="alert">{state.error}</p>}
      <div className="flex gap-2">
        <button className="btn btn-primary" disabled={pending}>{pending ? "Sending…" : "Send report"}</button>
        <button type="button" className="btn btn-outline" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}
