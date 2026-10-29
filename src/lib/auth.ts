import { headers } from "next/headers";
import { timingSafeEqual } from "node:crypto";

// v1 admin access is HTTP basic auth (ADMIN_USER / ADMIN_PASSWORD), enforced
// on /admin by src/middleware.ts and re-checked inside every admin action.
// Replace with per-agent logins (phone + OTP) before onboarding a large team.

export function checkBasicAuth(header: string | null): boolean {
  const user = process.env.ADMIN_USER;
  const pass = process.env.ADMIN_PASSWORD;
  if (!user || !pass || !header?.startsWith("Basic ")) return false;
  const decoded = Buffer.from(header.slice(6), "base64").toString();
  const expected = `${user}:${pass}`;
  const a = Buffer.from(decoded);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function isAdmin(): Promise<boolean> {
  return checkBasicAuth((await headers()).get("authorization"));
}

export async function requireAdmin() {
  if (!(await isAdmin())) throw new Error("Not authorised");
}
