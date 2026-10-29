import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";

// Anonymous visitor id, so a review can be tied to a real WhatsApp/call tap
// without making people create an account. Holds no personal data.
export const VISITOR_COOKIE = "fa_vid";

export async function readVisitorId(): Promise<string | null> {
  return (await cookies()).get(VISITOR_COOKIE)?.value ?? null;
}

/** Read the visitor id, creating one if missing. Only call from route handlers and server actions. */
export async function ensureVisitorId(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(VISITOR_COOKIE)?.value;
  if (existing) return existing;
  const id = randomUUID();
  jar.set(VISITOR_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  return id;
}
