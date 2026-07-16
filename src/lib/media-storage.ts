import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { newId } from "./ids";

const storageRoot = resolve(process.cwd(), "storage");

function safeExtension(fileName: string, fallback = ".png") {
  const ext = extname(fileName).toLowerCase();
  return /^[.]([a-z0-9]{1,5})$/.test(ext) ? ext : fallback;
}

export function storageAbsolutePath(relativePath: string) {
  const resolved = resolve(storageRoot, relativePath);
  if (!resolved.startsWith(`${storageRoot}/`)) throw new Error("Invalid media path.");
  return resolved;
}

export async function saveUploadedProductMedia(productId: string, fileName: string, data: Buffer) {
  const relative = `uploads/products/${productId}/${newId()}${safeExtension(fileName)}`;
  const absolute = storageAbsolutePath(relative);
  await mkdir(resolve(absolute, ".."), { recursive: true });
  await writeFile(absolute, data);
  return relative;
}

export async function saveGeneratedSocialImage(productId: string, data: Buffer) {
  const relative = `generated/social/${productId}/${newId()}.png`;
  const absolute = storageAbsolutePath(relative);
  await mkdir(resolve(absolute, ".."), { recursive: true });
  await writeFile(absolute, data);
  return relative;
}

export function mediaUrl(relativePath: string) {
  return `/api/media/${relativePath.split("/").map(encodeURIComponent).join("/")}`;
}
