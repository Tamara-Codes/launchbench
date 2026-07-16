import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { ProductEditorClient } from "@/components/product-editor-client";
import { getProduct, getProductSocialStrategy, listMediaAssets } from "@/server/repo";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product, strategy, media] = await Promise.all([getProduct(id), getProductSocialStrategy(id), listMediaAssets(id)]);
  if (!product) notFound();
  return <div className="space-y-6"><Link href="/products" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Back to products</Link><PageHeader title={product.name} description="Verified product facts and product-specific instructions for the Sales and Content Agents." /><ProductEditorClient product={product} strategy={strategy} mediaCount={media.length} /></div>;
}
