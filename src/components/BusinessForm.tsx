"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { addBusiness, type AddState } from "@/app/add/actions";
import { Icon } from "./Icon";

type Opt = { id: number; name?: string; label?: string; parent_id?: number | null };

export function BusinessForm({
  categories,
  areas,
  sections,
  mode = "web",
}: {
  categories: Opt[];
  areas: Opt[];
  sections: Opt[];
  mode?: "web" | "agent";
}) {
  const [state, action, pending] = useActionState<AddState, FormData>(addBusiness, {});
  const [comesToYou, setComesToYou] = useState(false);
  const [coords, setCoords] = useState<{ lat: string; lng: string } | null>(null);
  const [locMsg, setLocMsg] = useState<string | null>(null);
  const v = state.values ?? {};

  if (state.ok) {
    return (
      <div className="card flex flex-col gap-3 p-5">
        <p className="font-display text-2xl font-extrabold text-brand">
          {state.status === "live" ? "Listing is live." : "Thank you, we got it."}
        </p>
        <p className="text-muted">
          {state.status === "live"
            ? "It now shows in search."
            : "We check every new listing before it goes live, usually within 2 days. We may call or visit to verify it."}
        </p>
        <div className="flex flex-wrap gap-2">
          {state.status === "live" && <Link href={`/b/${state.slug}`} className="btn btn-primary">View listing</Link>}
          <a href={mode === "agent" ? "/admin/add" : "/add"} className="btn btn-outline">Add another</a>
        </div>
      </div>
    );
  }

  function useMyLocation() {
    if (!("geolocation" in navigator)) return setLocMsg("Location isn't available on this phone.");
    setLocMsg("Getting location…");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setCoords({ lat: p.coords.latitude.toFixed(6), lng: p.coords.longitude.toFixed(6) });
        setLocMsg(`Pinned (accurate to about ${Math.round(p.coords.accuracy)} m).`);
      },
      () => setLocMsg("Couldn't get location. You can leave it out."),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  const parents = categories.filter((c) => !c.parent_id);
  const childrenOf = (id: number) => categories.filter((c) => c.parent_id === id);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="mode" value={mode} />

      <Field label="Business name" required>
        <input name="name" className="field" defaultValue={v.name} maxLength={80} required />
      </Field>

      <Field label="What does it do?" required>
        <select name="categoryId" className="field" defaultValue={v.categoryId ?? ""} required>
          <option value="" disabled>Choose a category</option>
          {parents.map((p) => (
            <optgroup key={p.id} label={p.name}>
              {childrenOf(p.id).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </Field>

      <Field label="Short description" hint="What you do, in one line">
        <input name="description" className="field" defaultValue={v.description} maxLength={300} />
      </Field>

      <Field label="Area" required>
        <select name="areaId" className="field" defaultValue={v.areaId ?? ""} required>
          <option value="" disabled>Choose the area</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </Field>

      <label className="flex min-h-11 items-center gap-3">
        <input type="checkbox" name="comesToYou" className="h-5 w-5 accent-brand" onChange={(e) => setComesToYou(e.target.checked)} />
        <span>I go to customers (plumber, AC repair, caterer…)</span>
      </label>

      {comesToYou && (
        <fieldset className="card flex flex-col gap-2 p-3">
          <legend className="px-1 text-[14px] font-bold">Areas you cover</legend>
          <div className="grid grid-cols-2 gap-1.5">
            {areas.map((a) => (
              <label key={a.id} className="flex min-h-10 items-center gap-2 text-[14px]">
                <input type="checkbox" name="serviceAreaIds" value={a.id} className="h-4 w-4 accent-brand" />
                {a.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <Field label="Inside a market?" hint="Leave blank if not">
        <select name="marketSectionId" className="field" defaultValue={v.marketSectionId ?? ""}>
          <option value="">Not in a market</option>
          {sections.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      </Field>

      <Field label="Shop number" hint="e.g. D47">
        <input name="shopNumber" className="field" defaultValue={v.shopNumber} maxLength={20} />
      </Field>

      <Field label="How do customers find you?" hint={'Say it like you\'re giving directions: "Opposite Mobil, second street, blue gate"'}>
        <textarea name="landmarkDirections" className="field min-h-24" defaultValue={v.landmarkDirections} maxLength={400} />
      </Field>

      <div className="flex flex-col gap-1.5">
        <span className="text-[14px] font-bold">Map pin</span>
        <p className="text-[13px] text-muted">Standing at the shop? Tap to drop a pin so people see how far you are.</p>
        <button type="button" onClick={useMyLocation} className="btn btn-outline self-start">
          <Icon name="locate" size={18} /> Use where I&apos;m standing
        </button>
        {locMsg && <p className="text-[13px] text-muted" aria-live="polite">{locMsg}</p>}
        <input type="hidden" name="lat" value={coords?.lat ?? v.lat ?? ""} />
        <input type="hidden" name="lng" value={coords?.lng ?? v.lng ?? ""} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="WhatsApp number" hint="Customers will chat you here">
          <input name="whatsapp" type="tel" inputMode="tel" className="field" placeholder="0801 234 5678" defaultValue={v.whatsapp} />
        </Field>
        <Field label="Phone for calls" hint="If different">
          <input name="phone" type="tel" inputMode="tel" className="field" defaultValue={v.phone} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Lowest price (₦)">
          <input name="priceMin" inputMode="numeric" className="field" defaultValue={v.priceMin} />
        </Field>
        <Field label="Highest price (₦)">
          <input name="priceMax" inputMode="numeric" className="field" defaultValue={v.priceMax} />
        </Field>
      </div>

      <Field label="Opening hours" hint="e.g. Mon to Sat, 9am to 7pm">
        <input name="hoursNote" className="field" defaultValue={v.hoursNote} maxLength={80} />
      </Field>

      <Field label="Photo of your entrance" hint="Helps customers know they're in the right place">
        <input name="entrancePhoto" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="field" />
      </Field>
      <Field label="Photos of your work (up to 6)">
        <input name="workPhotos" type="file" accept="image/jpeg,image/png,image/webp" multiple className="field" />
      </Field>

      {mode === "agent" && (
        <Field label="Agent note" hint="What you checked on the visit">
          <textarea name="agentNote" className="field min-h-20" maxLength={300} />
        </Field>
      )}

      {state.error && (
        <p className="rounded-xl bg-[#fdecea] p-3 text-[14px] font-bold text-alert" role="alert">
          {state.error}
        </p>
      )}

      <button className="btn btn-primary min-h-[52px] text-base" disabled={pending}>
        {pending ? "Saving…" : mode === "agent" ? "Save verified listing" : "List my business free"}
      </button>
    </form>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[14px] font-bold">
        {label}
        {required && <span className="text-alert"> *</span>}
      </span>
      {hint && <span className="text-[13px] text-muted">{hint}</span>}
      {children}
    </label>
  );
}
