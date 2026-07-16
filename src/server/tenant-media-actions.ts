"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "./tenant-context";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/avif", "image/jpeg", "image/png", "image/webp"]);

export async function uploadTenantMedia(formData: FormData) {
  try {
    const productId = z.string().uuid().parse(formData.get("productId")); const file = formData.get("file");
    if (!(file instanceof File) || !file.size) throw new Error("Choose an image to upload.");
    if (!ALLOWED_TYPES.has(file.type) || file.size > MAX_BYTES) throw new Error("Use an AVIF, JPEG, PNG, or WebP image up to 10 MB.");
    const context = await getTenantContext(); if (!context || context.role === "member") throw new Error("Only workspace owners and admins can upload media.");
    const supabase = await createClient(); const { data: product } = await supabase.from("products").select("id").eq("id", productId).eq("workspace_id", context.workspace.id).maybeSingle();
    if (!product) throw new Error("Product not found in this workspace.");
    const extension = file.type.split("/")[1] ?? "png"; const path = `${context.workspace.id}/${productId}/uploads/${randomUUID()}.${extension}`;
    const admin = createAdminClient(); const { error: uploadError } = await admin.storage.from("workspace-media").upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
    if (uploadError) throw new Error(uploadError.message);
    const { error } = await admin.from("workspace_media_assets").insert({ workspace_id: context.workspace.id, product_id: productId, storage_path: path, file_name: file.name.slice(0, 255), mime_type: file.type, byte_size: file.size, tags: [], notes: "" });
    if (error) { await admin.storage.from("workspace-media").remove([path]); throw new Error(error.message); }
    revalidatePath("/app/media"); return { ok: true as const };
  } catch (error) { return { ok: false as const, error: error instanceof Error ? error.message : "Could not upload media." }; }
}
