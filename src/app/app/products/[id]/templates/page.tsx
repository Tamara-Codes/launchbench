import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, PageHeader } from "@/components/ui";
import { TenantTemplateEditor } from "@/components/tenant-template-editor";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/server/tenant-context";

export const dynamic = "force-dynamic";

export default async function ProductTemplatesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const context = await getTenantContext(); if (!context) redirect("/onboarding");
  const supabase = await createClient();
  const [{ data: product }, { data: templates }] = await Promise.all([
    supabase.from("products").select("id, name, preferred_language").eq("id", id).eq("workspace_id", context.workspace.id).maybeSingle(),
    supabase.from("email_templates").select("language, sequence_step, name, subject, body").eq("product_id", id).eq("workspace_id", context.workspace.id).order("sequence_step"),
  ]);
  if (!product) notFound();
  return <main className="mx-auto max-w-4xl px-6 py-6"><Link className="text-sm text-accent" href="/app/products">← Products</Link><div className="mt-4"><PageHeader title={product.name} /></div><nav className="mt-4 flex gap-5" aria-label="Product settings"><Link href={`/app/products/${product.id}`} className="py-2 text-sm font-medium text-muted hover:text-ink">Product context</Link><Link href={`/app/products/${product.id}/templates`} className="py-2 text-sm font-medium text-accent"><span className="border-b-2 border-accent pb-2">Email templates</span></Link></nav><Card className="mt-4"><CardHeader className="p-4 pb-2"><CardTitle>Email templates</CardTitle><p className="text-sm text-muted">Templates the Sales Agent uses to write email drafts for {product.name}.</p></CardHeader><CardContent className="p-4 pt-0"><TenantTemplateEditor productId={product.id} templates={templates ?? []} language={product.preferred_language} /></CardContent></Card></main>;
}
