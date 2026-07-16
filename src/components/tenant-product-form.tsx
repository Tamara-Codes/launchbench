"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label, Textarea } from "./ui";
import { createTenantProduct, updateTenantProduct } from "@/server/tenant-actions";

type Product = {
  id?: string; name: string; short_description: string; full_description: string;
  target_customer: string; core_benefit: string; price_text: string; demo_url: string;
  website_url: string; email_generation_context: string; preferred_language: string;
};

const empty: Product = { name: "", short_description: "", full_description: "", target_customer: "", core_benefit: "", price_text: "", demo_url: "", website_url: "", email_generation_context: "", preferred_language: "hr" };

export function TenantProductForm({ product }: { product?: Product }) {
  const router = useRouter();
  const [form, setForm] = useState<Product>(product ?? empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (key: keyof Product, value: string) => setForm((current) => ({ ...current, [key]: value }));
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const result = product?.id ? await updateTenantProduct(product.id, form) : await createTenantProduct(form);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    router.push(product?.id ? `/app/products/${product.id}` : `/app/products/${result.data?.id}`);
    router.refresh();
  }
  return <form onSubmit={submit} className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Product/project name" value={form.name} onChange={(v) => set("name", v)} required /><Field label="Preferred language" value={form.preferred_language} onChange={(v) => set("preferred_language", v)} required /></div>
    <Area label="Short description" value={form.short_description} onChange={(v) => set("short_description", v)} rows={2} />
    <Area label="Full description" value={form.full_description} onChange={(v) => set("full_description", v)} rows={5} />
    <div className="grid gap-4 sm:grid-cols-2"><Area label="Target customer" value={form.target_customer} onChange={(v) => set("target_customer", v)} rows={4} /><Area label="Core benefit" value={form.core_benefit} onChange={(v) => set("core_benefit", v)} rows={4} /></div>
    <div className="grid gap-4 sm:grid-cols-3"><Field label="Price text" value={form.price_text} onChange={(v) => set("price_text", v)} /><Field label="Demo URL" value={form.demo_url} onChange={(v) => set("demo_url", v)} /><Field label="Website URL" value={form.website_url} onChange={(v) => set("website_url", v)} /></div>
    <Area label="Sales-email context" value={form.email_generation_context} onChange={(v) => set("email_generation_context", v)} rows={5} hint="Facts and boundaries the Sales Agent must use when drafting outreach." />
    {error && <p className="text-sm text-danger" role="alert">{error}</p>}<Button disabled={busy}>{busy ? "Saving…" : product ? "Save product" : "Create product"}</Button>
  </form>;
}
function Field({ label, value, onChange, required }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) { return <div className="space-y-1.5"><Label>{label}</Label><Input value={value} onChange={(event) => onChange(event.target.value)} required={required} /></div>; }
function Area({ label, value, onChange, rows, hint }: { label: string; value: string; onChange: (value: string) => void; rows: number; hint?: string }) { return <div className="space-y-1.5"><Label>{label}</Label>{hint && <p className="text-xs text-muted">{hint}</p>}<Textarea rows={rows} value={value} onChange={(event) => onChange(event.target.value)} /></div>; }
