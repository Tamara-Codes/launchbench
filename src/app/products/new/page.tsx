import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { ProductEditorClient } from "@/components/product-editor-client";

export default function NewProductPage() {
  return <div className="space-y-6"><Link href="/products" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Back to products</Link><PageHeader title="New product" description="Start with verified facts. You can add its sales context, content strategy and media after creating it." /><ProductEditorClient creating /></div>;
}
