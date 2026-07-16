"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { requestTenantJob } from "@/server/tenant-job-actions";
import { Button, Input, Label, Select, Textarea } from "./ui";

export function TenantContentPanel({ products }: { products: Array<{ id: string; name: string; preferred_language: string }> }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(formData: FormData) {
    setBusy(true); setError("");
    const result = await requestTenantJob({ kind: "content_generation", productId: String(formData.get("productId")), input: { contentType: String(formData.get("contentType")), format: String(formData.get("format")), language: String(formData.get("language")), extraInstruction: String(formData.get("extraInstruction")), mode: String(formData.get("mode")), variations: Number(formData.get("variations") || 1) } });
    setBusy(false); if (!result.ok) setError(result.error); else router.refresh();
  }
  return <form action={submit} className="grid gap-3 rounded-xl border p-5 md:grid-cols-2">{error && <p className="text-sm text-danger md:col-span-2" role="alert">{error}</p>}<label><Label>Product</Label><Select name="productId" required defaultValue=""><option value="" disabled>Select product</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></label><label><Label>Content type</Label><Input name="contentType" required placeholder="Local travel tip" /></label><label><Label>Format</Label><Select name="format" defaultValue="single_image"><option value="single_image">Single image</option><option value="carousel">Carousel</option><option value="story">Story</option></Select></label><label><Label>Generate</Label><Select name="mode" defaultValue="full"><option value="caption">Caption only</option><option value="image">Image and post idea</option><option value="full">Caption and image</option></Select></label><label><Label>Language</Label><Input name="language" defaultValue={products[0]?.preferred_language ?? "hr"} required /></label><label><Label>Variations</Label><Input name="variations" type="number" min="1" max="3" defaultValue="1" required /></label><label className="md:col-span-2"><Label>Extra instruction</Label><Textarea name="extraInstruction" maxLength={2000} placeholder="Optional campaign context or constraint" /></label><div className="md:col-span-2"><Button disabled={busy || !products.length}>{busy ? "Queueing…" : "Queue Content Agent"}</Button></div></form>;
}
