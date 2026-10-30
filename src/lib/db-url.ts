// Neon connection strings use sslmode=require. The pg library currently treats
// that as verify-full but warns that a future version will weaken it, so ask
// for verify-full explicitly: encrypted, with the server certificate checked.
// Local URLs without sslmode are left alone.
export function databaseUrl(raw = process.env.DATABASE_URL): string | undefined {
  if (!raw) return raw;
  return raw.replace(/([?&]sslmode=)(prefer|require|verify-ca)\b/, "$1verify-full");
}
