"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, Sparkles } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Textarea } from "./ui";
import { Select } from "./ui-select";
import { toast } from "./toast";
import { createSocialContent } from "@/server/actions";

const TYPES = ["Surprise me", "Product showcase", "Educational", "Gift idea", "Behind the scenes", "Parent problem / solution", "How it works", "Feature highlight", "Comparison", "Seasonal / holiday", "Soft sales", "Direct sales", "Brand-building / founder story"];

export function ContentStudioClient({ products, media, selectedProductId }: { products: Array<{ id: string; name: string; language: string }>; media: Array<{ id: string; productId: string; productName: string; fileName: string; preferred: boolean }>; selectedProductId?: string | null }) {
  const router = useRouter();
  const [productId, setProductId] = useState(selectedProductId ?? products[0]?.id ?? "");
  const [contentType, setContentType] = useState("Surprise me");
  const [format, setFormat] = useState<"single_image" | "carousel" | "story">("single_image");
  const [mode, setMode] = useState<"caption" | "image" | "full">("full");
  const [instruction, setInstruction] = useState("");
  const [references, setReferences] = useState<string[]>([]);
  const [variations, setVariations] = useState(1);
  const [pending, start] = useTransition();
  const selected = products.find((product) => product.id === productId);
  const assets = useMemo(() => media.filter((asset) => asset.productId === productId), [media, productId]);

  function generate() {
    start(async () => {
      const result = await createSocialContent({ productId, contentType: contentType === "Surprise me" ? "surprise" : contentType, format, language: selected?.language || "hr", extraInstruction: instruction, referenceAssetIds: references, mode, variations });
      if (!result.ok) return toast(result.error, "error");
      toast(`Created ${result.data?.ids.length ?? 0} content item(s).`, "success");
      router.push("/content-calendar");
      router.refresh();
    });
  }

  return <div className="space-y-6"><div><h1 className="text-xl font-semibold tracking-tight text-ink-strong">Content Studio</h1><p className="mt-0.5 text-sm text-muted">Create a product-aware post. You review and publish everything manually.</p></div><Card><CardHeader><CardTitle>Post brief</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label>Product</Label><Select value={productId} onChange={(event) => { setProductId(event.target.value); setReferences([]); }}><option value="">Select product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</Select></div><div className="space-y-1.5"><Label>Content type</Label><Select value={contentType} onChange={(event) => setContentType(event.target.value)}>{TYPES.map((type) => <option key={type}>{type}</option>)}</Select></div><div className="space-y-1.5"><Label>Format</Label><Select value={format} onChange={(event) => setFormat(event.target.value as typeof format)}><option value="single_image">Single image</option><option value="carousel">Carousel</option><option value="story">Story</option></Select></div><div className="space-y-1.5"><Label>Generate</Label><Select value={mode} onChange={(event) => setMode(event.target.value as typeof mode)}><option value="full">Caption + image</option><option value="caption">Caption only</option><option value="image">Image only</option></Select></div><div className="space-y-1.5"><Label>Variations</Label><Input type="number" min="1" max="3" value={variations} onChange={(event) => setVariations(Math.max(1, Math.min(3, Number(event.target.value) || 1)))} /></div><div className="space-y-1.5"><Label>Extra instruction</Label><Textarea rows={3} value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder="Optional theme, occasion, or angle" /></div><div className="sm:col-span-2 space-y-2"><Label>Reference media</Label><p className="text-xs text-muted">Select real product photos to preserve product fidelity. If you leave this empty, preferred references are selected automatically.</p>{assets.length ? <div className="grid gap-2 sm:grid-cols-2">{assets.map((asset) => <label key={asset.id} className="flex items-center gap-2 rounded-lg border p-2 text-sm"><input type="checkbox" checked={references.includes(asset.id)} onChange={() => setReferences((current) => current.includes(asset.id) ? current.filter((id) => id !== asset.id) : [...current, asset.id])} /><ImagePlus className="h-4 w-4 text-accent" />{asset.fileName}{asset.preferred && <span className="ml-auto text-xs text-muted">preferred</span>}</label>)}</div> : <p className="rounded-lg bg-surface2 p-3 text-sm text-muted">No media for this product yet. Upload product photos in Media Library, or generate from the strategy alone.</p>}</div><div className="sm:col-span-2"><Button disabled={!productId || pending} onClick={generate}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Generate post</Button></div></CardContent></Card></div>;
}
