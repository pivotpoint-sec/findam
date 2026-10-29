"use server";

import { z } from "zod";
import { createBusiness } from "@/lib/create-business";
import { savePhoto } from "@/lib/storage";
import { normalisePhone } from "@/lib/format";
import { isAdmin } from "@/lib/auth";

export type AddState = { ok?: boolean; slug?: string; status?: string; error?: string; values?: Record<string, string> };

const optionalInt = z.preprocess(
  (v) => (v === "" || v == null ? undefined : Number(String(v).replace(/[^\d]/g, ""))),
  z.number().int().nonnegative().optional(),
);
const optionalCoord = z.preprocess((v) => (v === "" || v == null ? undefined : Number(v)), z.number().optional());

const schema = z.object({
  name: z.string().trim().min(2, "Add the business name").max(80),
  categoryId: z.coerce.number().int().positive("Pick what the business does"),
  areaId: z.coerce.number().int().positive("Pick the area"),
  marketSectionId: optionalInt,
  shopNumber: z.string().trim().max(20).optional(),
  description: z.string().trim().max(300).optional(),
  landmarkDirections: z.string().trim().max(400).optional(),
  whatsapp: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  priceMin: optionalInt,
  priceMax: optionalInt,
  hoursNote: z.string().trim().max(80).optional(),
  comesToYou: z.string().optional(),
  lat: optionalCoord,
  lng: optionalCoord,
  agentNote: z.string().trim().max(300).optional(),
  mode: z.enum(["web", "agent"]).default("web"),
});

export async function addBusiness(_: AddState, form: FormData): Promise<AddState> {
  const values = Object.fromEntries(
    [...form.entries()].filter(([, v]) => typeof v === "string") as [string, string][],
  );
  const parsed = schema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form", values };
  const d = parsed.data;

  if (d.mode === "agent" && !(await isAdmin())) return { error: "Agent mode needs an admin login.", values };

  const whatsapp = normalisePhone(d.whatsapp);
  const phone = normalisePhone(d.phone);
  if (d.whatsapp && !whatsapp) return { error: "WhatsApp number doesn't look like a Nigerian number", values };
  if (d.phone && !phone) return { error: "Phone number doesn't look like a Nigerian number", values };
  if (!whatsapp && !phone) return { error: "Add a WhatsApp or phone number so customers can reach you", values };
  if (!d.landmarkDirections && !d.marketSectionId && !d.comesToYou) {
    return { error: "Tell customers how to find you (landmark directions)", values };
  }
  if (d.lat != null && (d.lat < 6.2 || d.lat > 6.8 || d.lng == null || d.lng < 2.7 || d.lng > 4.4)) {
    return { error: "That location is outside Lagos. Try again from the shop, or leave it out.", values };
  }

  const serviceAreaIds = form.getAll("serviceAreaIds").map(Number).filter((n) => Number.isInteger(n) && n > 0);

  const photos: { url: string; kind: "entrance" | "work" }[] = [];
  try {
    const entrance = form.get("entrancePhoto");
    if (entrance instanceof File && entrance.size > 0) {
      photos.push({ url: await savePhoto(await entrance.arrayBuffer(), entrance.type), kind: "entrance" });
    }
    for (const f of form.getAll("workPhotos").slice(0, 6)) {
      if (f instanceof File && f.size > 0) photos.push({ url: await savePhoto(await f.arrayBuffer(), f.type), kind: "work" });
    }
  } catch (e) {
    return { error: (e as Error).message, values };
  }

  const created = await createBusiness(
    {
      name: d.name,
      categoryId: d.categoryId,
      areaId: d.areaId,
      marketSectionId: d.marketSectionId ?? null,
      shopNumber: d.shopNumber,
      description: d.description,
      landmarkDirections: d.landmarkDirections,
      lat: d.lat ?? null,
      lng: d.lng ?? null,
      whatsapp,
      phone,
      priceMin: d.priceMin ?? null,
      priceMax: d.priceMax ?? null,
      comesToYou: d.comesToYou === "on",
      serviceAreaIds,
      hoursNote: d.hoursNote,
      photos,
      ownerPhone: d.mode === "web" ? whatsapp ?? phone : null,
    },
    d.mode === "agent" ? { source: "agent", agentNote: d.agentNote } : { source: "web" },
  );
  return { ok: true, slug: created.slug, status: created.status };
}
