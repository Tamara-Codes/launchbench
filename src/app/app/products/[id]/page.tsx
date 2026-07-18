import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, PageHeader } from "@/components/ui";
import { TenantProductForm } from "@/components/tenant-product-form";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/server/tenant-context";

export const dynamic = "force-dynamic";

export default async function TenantProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const context = await getTenantContext(); if (!context) redirect("/onboarding");
  const supabase = await createClient();
  const { data: product } = await supabase.from("products").select("*").eq("id", id).eq("workspace_id", context.workspace.id).maybeSingle();
  if (!product) notFound();
  return <main className="mx-auto max-w-4xl px-6 py-12"><Link className="text-sm text-accent" href="/app/products">← Products</Link><div className="mt-5"><PageHeader title={product.name} /></div><nav className="mt-6 flex gap-5" aria-label="Product settings"><Link href={`/app/products/${product.id}`} className="py-2 text-sm font-medium text-accent"><span className="border-b-2 border-accent pb-2">Product context</span></Link><Link href={`/app/products/${product.id}/templates`} className="py-2 text-sm font-medium text-muted hover:text-ink">Email templates</Link></nav><Card className="mt-6"><CardHeader><CardTitle>Product context</CardTitle></CardHeader><CardContent><TenantProductForm product={product} /></CardContent></Card></main>;
}
