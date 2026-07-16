"use client";

import { type FormEvent, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { CheckCircle2, ImagePlus, Loader2, Star, Tag, Trash2, X } from "lucide-react";
import { Badge, Button, Card, CardContent, EmptyState, Input, Label, Textarea } from "@/components/ui";
import { Select } from "@/components/ui-select";
import { toast } from "@/components/toast";
import { deleteMediaAsset, setMediaAssetFlag, uploadProductMedia } from "@/server/actions";

type Product = { id: string; name: string };
type MediaAsset = {
  id: string;
  productId: string;
  productName: string;
  filePath: string;
  fileName: string;
  mimeType: string;
  tags: string[];
  notes: string;
  isPreferredReference: boolean;
  isApprovedBrandAsset: boolean;
};

function assetUrl(filePath: string) {
  return `/api/media/${filePath.split("/").map(encodeURIComponent).join("/")}`;
}

export function MediaLibraryClient({ products, assets, initialProductId = "" }: { products: Product[]; assets: MediaAsset[]; initialProductId?: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [productFilter, setProductFilter] = useState(initialProductId);
  const [tagFilter, setTagFilter] = useState("");
  const [uploading, setUploading] = useState(false);
  const [busyAssetId, setBusyAssetId] = useState<string | null>(null);
  const tags = useMemo(
    () => Array.from(new Set(assets.flatMap((asset) => asset.tags))).sort((a, b) => a.localeCompare(b)),
    [assets],
  );
  const visibleAssets = assets.filter(
    (asset) => (!productFilter || asset.productId === productFilter) && (!tagFilter || asset.tags.includes(tagFilter)),
  );

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!products.length) return toast("Create a product before uploading media.", "error");
    setUploading(true);
    const result = await uploadProductMedia(new FormData(event.currentTarget));
    setUploading(false);
    if (!result.ok) return toast(result.error, "error");
    formRef.current?.reset();
    toast("Media uploaded.", "success");
    router.refresh();
  }

  async function toggle(asset: MediaAsset, flag: "isPreferredReference" | "isApprovedBrandAsset") {
    setBusyAssetId(asset.id);
    const result = await setMediaAssetFlag(asset.id, flag, !asset[flag]);
    setBusyAssetId(null);
    if (!result.ok) return toast(result.error, "error");
    router.refresh();
  }

  async function remove(asset: MediaAsset) {
    if (!window.confirm(`Delete ${asset.fileName}? This cannot be undone.`)) return;
    setBusyAssetId(asset.id);
    const result = await deleteMediaAsset(asset.id);
    setBusyAssetId(null);
    if (!result.ok) return toast(result.error, "error");
    toast("Media deleted.", "success");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="pt-5">
          <form ref={formRef} onSubmit={upload} className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_12rem_14rem_auto] lg:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="media-file">Image file</Label>
              <Input id="media-file" name="file" type="file" accept="image/avif,image/gif,image/jpeg,image/png,image/webp" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="media-product">Product</Label>
              <Select id="media-product" name="productId" required defaultValue={initialProductId || products[0]?.id || ""} disabled={!products.length}>
                {products.length === 0 ? <option value="">No products available</option> : products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="media-tags">Tags</Label>
              <Input id="media-tags" name="tags" placeholder="e.g. hotel, exterior" />
            </div>
            <Button type="submit" disabled={uploading || !products.length}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />} Upload
            </Button>
            <div className="space-y-1.5 lg:col-span-3">
              <Label htmlFor="media-notes">Notes <span className="font-normal">(optional)</span></Label>
              <Textarea id="media-notes" name="notes" rows={2} placeholder="Describe how this image should be used." />
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={productFilter} onChange={(event) => setProductFilter(event.target.value)} className="w-48">
          <option value="">All products</option>
          {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
        </Select>
        <Select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)} className="w-44">
          <option value="">All tags</option>
          {tags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
        </Select>
        {(productFilter || tagFilter) && <Button size="sm" variant="ghost" onClick={() => { setProductFilter(""); setTagFilter(""); }}><X className="h-4 w-4" /> Clear filters</Button>}
        <span className="ml-auto text-sm text-muted">{visibleAssets.length} asset{visibleAssets.length === 1 ? "" : "s"}</span>
      </div>

      {visibleAssets.length === 0 ? (
        <EmptyState
          icon={<ImagePlus className="h-8 w-8" />}
          title={assets.length ? "No media matches these filters" : "Your media library is empty"}
          description={assets.length ? "Try a different product or tag." : "Upload product images to use as approved brand assets or generation references."}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visibleAssets.map((asset) => (
            <Card key={asset.id} className="overflow-hidden">
              <div className="relative aspect-[4/3] w-full bg-surface2"><Image src={assetUrl(asset.filePath)} alt={asset.fileName} fill sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw" className="object-cover" /></div>
              <CardContent className="space-y-3 pt-4">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink-strong" title={asset.fileName}>{asset.fileName}</p>
                  <p className="text-xs text-muted">{asset.productName}</p>
                </div>
                {asset.tags.length > 0 && <div className="flex flex-wrap gap-1">{asset.tags.map((tag) => <Badge key={tag} tone="neutral"><Tag className="h-3 w-3" /> {tag}</Badge>)}</div>}
                {asset.notes && <p className="line-clamp-2 text-xs text-muted">{asset.notes}</p>}
                <div className="flex flex-wrap gap-2 border-t pt-3">
                  <Button size="sm" variant={asset.isPreferredReference ? "secondary" : "outline"} disabled={busyAssetId === asset.id} onClick={() => toggle(asset, "isPreferredReference")}>
                    <Star className="h-3.5 w-3.5" /> {asset.isPreferredReference ? "Reference" : "Mark reference"}
                  </Button>
                  <Button size="sm" variant={asset.isApprovedBrandAsset ? "success" : "outline"} disabled={busyAssetId === asset.id} onClick={() => toggle(asset, "isApprovedBrandAsset")}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> {asset.isApprovedBrandAsset ? "Approved" : "Approve"}
                  </Button>
                  <Button size="icon" variant="ghost" className="ml-auto text-danger hover:text-danger" aria-label={`Delete ${asset.fileName}`} disabled={busyAssetId === asset.id} onClick={() => remove(asset)}>
                    {busyAssetId === asset.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
