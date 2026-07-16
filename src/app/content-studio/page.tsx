import { ContentStudioClient } from "@/components/content-studio-client";
import { listMediaAssets, listProducts } from "@/server/repo";
import { getSelectedProduct } from "@/server/product-context";

export const dynamic = "force-dynamic";

export default async function ContentStudioPage() {
  const [products, media, selectedProduct] = await Promise.all([listProducts(), listMediaAssets(), getSelectedProduct()]);
  return <ContentStudioClient selectedProductId={selectedProduct?.id} products={products.map((product) => ({ id: product.id, name: product.name, language: product.preferredLanguage }))} media={media.map(({ asset, product }) => ({ id: asset.id, productId: asset.productId, productName: product.name, fileName: asset.fileName, preferred: asset.isPreferredReference }))} />;
}
