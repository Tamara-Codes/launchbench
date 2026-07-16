import { readFile, stat } from "node:fs/promises";
import { extname } from "node:path";
import { storageAbsolutePath } from "@/lib/media-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIME_TYPES: Record<string, string> = {
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  if (
    path.length !== 4 ||
    !path.every((segment) => segment && segment !== "." && segment !== ".." && !segment.includes("/") && !segment.includes("\\")) ||
    !(
      (path[0] === "uploads" && path[1] === "products") ||
      (path[0] === "generated" && path[1] === "social")
    )
  ) {
    return new Response("Not found", { status: 404 });
  }

  const relativePath = path.join("/");
  const mimeType = MIME_TYPES[extname(relativePath).toLowerCase()];
  if (!mimeType) return new Response("Not found", { status: 404 });

  try {
    const absolutePath = storageAbsolutePath(relativePath);
    const info = await stat(absolutePath);
    if (!info.isFile()) return new Response("Not found", { status: 404 });
    const data = await readFile(absolutePath);
    return new Response(data, {
      headers: {
        "content-type": mimeType,
        "content-length": String(data.byteLength),
        "cache-control": "private, max-age=86400",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
