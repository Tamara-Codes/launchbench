"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { uploadTenantMedia } from "@/server/tenant-media-actions";
import { Button, Input, Label, Select } from "./ui";

export function TenantMediaUpload({ products }: { products: Array<{ id: string; name: string }> }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(data: FormData) { setBusy(true); setError(""); const result = await uploadTenantMedia(data); setBusy(false); if (!result.ok) setError(result.error); else router.refresh(); }
  return <form action={submit} className="flex flex-wrap items-end gap-3 rounded-xl border p-5">{error && <p className="w-full text-sm text-danger" role="alert">{error}</p>}<label className="min-w-48 flex-1"><Label>Product</Label><Select name="productId" defaultValue="" required><option value="" disabled>Select product</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></label><label className="min-w-48 flex-1"><Label>Image</Label><Input name="file" type="file" accept="image/avif,image/jpeg,image/png,image/webp" required /></label><Button disabled={busy || !products.length}>{busy ? "Uploading…" : "Upload"}</Button></form>;
}
