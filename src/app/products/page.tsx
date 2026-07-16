import Link from "next/link";
import { ArrowRight, PackagePlus } from "lucide-react";
import { Badge, Button, Card, CardContent, EmptyState, PageHeader } from "@/components/ui";
import { listMediaAssets, listProducts } from "@/server/repo";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const [products, media] = await Promise.all([listProducts(), listMediaAssets()]);
  const mediaByProduct = new Map<string, number>();
  for (const item of media) mediaByProduct.set(item.asset.productId, (mediaByProduct.get(item.asset.productId) ?? 0) + 1);
  return <div className="space-y-6">
    <PageHeader title="Products" description="The shared source of truth for what each product is, who it serves and how both agents should represent it." actions={<Link href="/products/new"><Button><PackagePlus className="h-4 w-4" /> New product</Button></Link>} />
    {products.length === 0 ? <EmptyState icon={<PackagePlus className="h-8 w-8" />} title="No products yet" description="Add your first product to give the Sales and Content Agents verified context." action={<Link href="/products/new"><Button>Add product</Button></Link>} /> : <div className="grid gap-4 md:grid-cols-2">{products.map((product) => <Link key={product.id} href={`/products/${product.id}`}><Card className="h-full transition-colors hover:border-accent"><CardContent className="space-y-4 pt-5"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-ink-strong">{product.name}</p><p className="mt-1 line-clamp-2 text-sm text-muted">{product.shortDescription || product.fullDescription || "Add a short description to introduce this product."}</p></div><Badge tone={product.active ? "success" : "neutral"}>{product.active ? "Active" : "Inactive"}</Badge></div><div className="flex items-center justify-between border-t pt-3 text-sm"><span className="text-muted">{mediaByProduct.get(product.id) ?? 0} media asset{mediaByProduct.get(product.id) === 1 ? "" : "s"}</span><span className="inline-flex items-center gap-1 text-accent">Open product <ArrowRight className="h-4 w-4" /></span></div></CardContent></Card></Link>)}</div>}
  </div>;
}
