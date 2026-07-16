import { ContentItemsClient, type SocialContentItem } from "@/components/content-items-client";
import { listProducts, listSocialContent } from "@/server/repo";
import { getSelectedProduct } from "@/server/product-context";

export const dynamic = "force-dynamic";

export default async function ContentHistoryPage() {
  const [products, selectedProduct] = await Promise.all([listProducts(), getSelectedProduct()]);
  const rows = await listSocialContent({ includeArchived: true, productId: selectedProduct?.id });
  const items: SocialContentItem[] = rows.filter((row) => row.product).map(({ item, product }) => ({
    id: item.id, productId: item.productId, productName: product!.name, contentType: item.contentType,
    hook: item.hook, caption: item.caption, cta: item.cta, format: item.format, language: item.language,
    status: item.status, scheduledFor: item.scheduledFor?.toISOString() ?? null,
    postedAt: item.postedAt?.toISOString() ?? null, createdAt: item.createdAt.toISOString(),
  }));
  return <ContentItemsClient page="history" items={items} products={products.map((product) => ({ id: product.id, name: product.name }))} selectedProductId={selectedProduct?.id} />;
}
