import { PageHeader } from "@/components/ui";
import { MediaLibraryClient } from "@/components/media-library-client";
import { listMediaAssets, listProducts } from "@/server/repo";
import { getSelectedProduct } from "@/server/product-context";

export const dynamic = "force-dynamic";

export default async function MediaLibraryPage({ searchParams }: { searchParams: Promise<{ product?: string }> }) {
  const { product: initialProductId = "" } = await searchParams;
  const [assets, products, selectedProduct] = await Promise.all([listMediaAssets(), listProducts(), getSelectedProduct()]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Media Library"
        description="Upload and organize visual assets for product content."
      />
      <MediaLibraryClient
        products={products.map((product) => ({ id: product.id, name: product.name }))}
        initialProductId={products.some((product) => product.id === initialProductId) ? initialProductId : selectedProduct?.id ?? ""}
        assets={assets.map(({ asset, product }) => ({
          id: asset.id,
          productId: asset.productId,
          productName: product.name,
          filePath: asset.filePath,
          fileName: asset.fileName,
          mimeType: asset.mimeType,
          tags: asset.tags,
          notes: asset.notes,
          isPreferredReference: asset.isPreferredReference,
          isApprovedBrandAsset: asset.isApprovedBrandAsset,
        }))}
      />
    </div>
  );
}
