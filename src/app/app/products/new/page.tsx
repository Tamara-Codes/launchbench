import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { TenantProductForm } from "@/components/tenant-product-form";

export default function NewTenantProductPage() {
  return <main className="mx-auto max-w-3xl px-6 py-12"><Link className="text-sm text-accent" href="/app/products">← Products</Link><div className="mt-5"><PageHeader title="New product" description="Create the product/project context that keeps Sales and Content work accurate." /></div><div className="mt-8 rounded-xl border bg-surface p-6"><TenantProductForm /></div></main>;
}
