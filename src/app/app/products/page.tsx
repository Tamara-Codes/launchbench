import Link from "next/link";
import { redirect } from "next/navigation";
import { Button, Card, CardContent, PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/server/tenant-context";

export const dynamic = "force-dynamic";

export default async function TenantProductsPage() {
  const context = await getTenantContext();
  if (!context) redirect("/onboarding");
  const supabase = await createClient();
  const { data: products } = await supabase.from("products").select("id, name, short_description, active, preferred_language").eq("workspace_id", context.workspace.id).order("name");
  return <main className="mx-auto max-w-5xl px-6 py-12"><div className="flex items-start justify-between gap-4"><PageHeader title="Products & projects" description="Each product keeps its own verified sales context and email templates." /><Link href="/app/products/new"><Button>Add product</Button></Link></div><div className="mt-8 grid gap-4 sm:grid-cols-2">{products?.map((product) => <Link key={product.id} href={`/app/products/${product.id}`}><Card className="h-full transition-colors hover:border-accent"><CardContent className="pt-5"><p className="font-semibold text-ink-strong">{product.name}</p><p className="mt-1 text-sm text-muted">{product.short_description || "Add verified product context and templates."}</p><p className="mt-4 text-xs uppercase text-muted">{product.preferred_language} · {product.active ? "Active" : "Inactive"}</p></CardContent></Card></Link>)}</div>{!products?.length && <p className="mt-8 text-muted">No products yet. Add the first offer your agents should work on.</p>}<Link className="mt-8 inline-block text-sm text-accent" href="/app">← Back to workspace</Link></main>;
}
