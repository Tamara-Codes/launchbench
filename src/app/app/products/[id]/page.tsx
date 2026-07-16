import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, PageHeader } from "@/components/ui";
import { TenantProductForm } from "@/components/tenant-product-form";
import { TenantTemplateEditor } from "@/components/tenant-template-editor";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/server/tenant-context";

export const dynamic = "force-dynamic";

export default async function TenantProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const context = await getTenantContext(); if (!context) redirect("/onboarding");
  const supabase = await createClient();
  const [{ data: product }, { data: templates }] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).eq("workspace_id", context.workspace.id).maybeSingle(),
    supabase.from("email_templates").select("language, sequence_step, name, subject, body").eq("product_id", id).eq("workspace_id", context.workspace.id).order("sequence_step"),
  ]);
  if (!product) notFound();
  return <main className="mx-auto max-w-4xl px-6 py-12"><Link className="text-sm text-accent" href="/app/products">← Products</Link><div className="mt-5"><PageHeader title={product.name} description="Product facts and templates stay isolated to this project." /></div><Card className="mt-8"><CardHeader><CardTitle>Product context</CardTitle></CardHeader><CardContent><TenantProductForm product={product} /></CardContent></Card><Card className="mt-8"><CardHeader><CardTitle>Email templates</CardTitle><p className="text-sm text-muted">These belong only to {product.name}; they cannot be used by another product.</p></CardHeader><CardContent><TenantTemplateEditor productId={product.id} templates={templates ?? []} language={product.preferred_language} /></CardContent></Card></main>;
}
