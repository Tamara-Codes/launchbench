"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label, Textarea } from "./ui";
import { createTenantProduct, updateTenantProduct } from "@/server/tenant-actions";

type Product = {
  id?: string;
  name: string;
  full_description: string;
  target_customer: string;
  core_benefit: string;
  website_url: string;
  preferred_language: string;
  email_generation_context: string;
  brand_voice: string;
  social_media_notes: string;
  visual_style: string;
  preferred_cta: string;
  content_dos: string;
  content_donts: string;
};

const empty: Product = {
  name: "", full_description: "", target_customer: "", core_benefit: "", website_url: "", preferred_language: "hr",
  email_generation_context: "", brand_voice: "", social_media_notes: "", visual_style: "", preferred_cta: "", content_dos: "", content_donts: "",
};

export function TenantProductForm({ product }: { product?: Product }) {
  const router = useRouter();
  const [form, setForm] = useState<Product>(product ? { ...empty, ...product } : empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (key: keyof Product, value: string) => setForm((current) => ({ ...current, [key]: value }));

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const payload = {
      name: form.name,
      fullDescription: form.full_description,
      targetCustomer: form.target_customer,
      coreBenefit: form.core_benefit,
      websiteUrl: form.website_url,
      preferredLanguage: form.preferred_language,
      emailGenerationContext: form.email_generation_context,
      brandVoice: form.brand_voice,
      socialMediaNotes: form.social_media_notes,
      visualStyle: form.visual_style,
      preferredCta: form.preferred_cta,
      contentDos: form.content_dos,
      contentDonts: form.content_donts,
    };
    const result = product?.id ? await updateTenantProduct(product.id, payload) : await createTenantProduct(payload);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    router.push(product?.id ? `/app/products/${product.id}` : `/app/products/${result.data?.id}`);
    router.refresh();
  }

  return <form onSubmit={submit} className="space-y-8">
    <section className="space-y-5">
      <div><h3 className="font-semibold text-ink">Product basics</h3><p className="mt-1 text-sm text-muted">The facts both agents use to understand what you sell.</p></div>
      <div className="grid gap-4 sm:grid-cols-[1fr_180px]"><Field label="Product name" value={form.name} onChange={(value) => set("name", value)} required /><Field label="Default language" value={form.preferred_language} onChange={(value) => set("preferred_language", value)} required placeholder="e.g. hr" /></div>
      <Area label="What is it?" value={form.full_description} onChange={(value) => set("full_description", value)} rows={4} required hint="Describe the product, what it includes, and how it works." />
      <div className="grid gap-4 sm:grid-cols-2"><Area label="Who is it for?" value={form.target_customer} onChange={(value) => set("target_customer", value)} rows={3} required /><Area label="Main benefit" value={form.core_benefit} onChange={(value) => set("core_benefit", value)} rows={3} required /></div>
      <Field label="Website" value={form.website_url} onChange={(value) => set("website_url", value)} placeholder="https://…" type="url" />
    </section>

    <section className="border-t border-border pt-8">
      <div><h3 className="font-semibold text-ink">Sales Agent guidance</h3><p className="mt-1 text-sm text-muted">What the Sales Agent may say, offer, and must avoid in outreach.</p></div>
      <div className="mt-5"><Area label="Sales guidance" value={form.email_generation_context} onChange={(value) => set("email_generation_context", value)} rows={5} required hint="Include offer details, proof points, preferred CTA, and claims the agent must not make." /></div>
    </section>

    <section className="border-t border-border pt-8">
      <div><h3 className="font-semibold text-ink">Marketing Agent guidance</h3><p className="mt-1 text-sm text-muted">Give the Marketing Agent a clear voice, message, and visual direction.</p></div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2"><Area label="Brand voice" value={form.brand_voice} onChange={(value) => set("brand_voice", value)} rows={3} placeholder="e.g. warm, direct, practical" /><Area label="Key messages" value={form.social_media_notes} onChange={(value) => set("social_media_notes", value)} rows={3} placeholder="Themes, facts, or angles to repeat" /><Area label="Visual direction" value={form.visual_style} onChange={(value) => set("visual_style", value)} rows={3} placeholder="Describe the look and feel for generated images" /><Area label="Preferred CTA" value={form.preferred_cta} onChange={(value) => set("preferred_cta", value)} rows={3} placeholder="e.g. Visit the website to learn more" /><Area label="Always do" value={form.content_dos} onChange={(value) => set("content_dos", value)} rows={3} /><Area label="Never do or claim" value={form.content_donts} onChange={(value) => set("content_donts", value)} rows={3} /></div>
    </section>

    {error && <p className="text-sm text-danger" role="alert">{error}</p>}
    <Button disabled={busy}>{busy ? "Saving…" : product ? "Save product" : "Create product"}</Button>
  </form>;
}

function Field({ label, value, onChange, required, placeholder, type = "text" }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; placeholder?: string; type?: string }) {
  return <div className="space-y-1.5"><Label>{label}</Label><Input type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} placeholder={placeholder} /></div>;
}

function Area({ label, value, onChange, rows, hint, required, placeholder }: { label: string; value: string; onChange: (value: string) => void; rows: number; hint?: string; required?: boolean; placeholder?: string }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{hint && <p className="text-xs text-muted">{hint}</p>}<Textarea rows={rows} value={value} onChange={(event) => onChange(event.target.value)} required={required} placeholder={placeholder} /></div>;
}
