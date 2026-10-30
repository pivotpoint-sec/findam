// Photo storage. v1 keeps files on local disk under UPLOAD_DIR and serves them
// from /uploads/<name>. Before running more than one server, replace save()
// with an upload to S3, Cloudinary or similar and return that URL instead.
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join, resolve, basename } from "node:path";
import { randomUUID } from "node:crypto";

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function uploadDir() {
  // The folder is chosen at runtime; tell the bundler not to trace the whole project for it.
  return resolve(/* turbopackIgnore: true */ process.env.UPLOAD_DIR || "./uploads");
}

export async function savePhoto(data: Buffer | ArrayBuffer, mime: string): Promise<string> {
  const ext = TYPES[mime];
  if (!ext) throw new Error("Photos must be JPEG, PNG or WebP.");
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
  if (buf.byteLength > MAX_BYTES) throw new Error("Photos must be under 5 MB.");
  const name = `${randomUUID()}.${ext}`;
  await mkdir(uploadDir(), { recursive: true });
  await writeFile(join(uploadDir(), name), buf);
  return `/uploads/${name}`;
}

/** Read a stored photo by file name; null if missing or the name is unsafe. */
export async function readPhoto(name: string): Promise<{ data: Buffer; type: string } | null> {
  if (name !== basename(name) || !/^[\w-]+\.(jpg|png|webp)$/.test(name)) return null;
  try {
    const data = await readFile(join(uploadDir(), name));
    const ext = name.split(".").pop()!;
    const type = Object.entries(TYPES).find(([, e]) => e === ext)?.[0] ?? "application/octet-stream";
    return { data, type };
  } catch {
    return null;
  }
}
