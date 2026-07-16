import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader, Table, Td, Th, Thead, Tr } from "@/components/ui";
import { TenantContentPanel } from "@/components/tenant-content-panel";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/server/tenant-context";

export const dynamic = "force-dynamic";
export default async function TenantContentPage() {
  const context = await getTenantContext(); if (!context) redirect("/onboarding"); const supabase = await createClient();
  const [{ data: products }, { data: items }] = await Promise.all([
    supabase.from("products").select("id, name, preferred_language").eq("workspace_id", context.workspace.id).eq("active", true).order("name"),
    supabase.from("content_items").select("id, content_type, hook, caption, format, language, status, created_at, content_generated_images(storage_path)").eq("workspace_id", context.workspace.id).order("created_at", { ascending: false }).limit(100),
  ]);
  return <main className="mx-auto max-w-6xl px-6 py-12"><Link className="text-sm text-accent" href="/app">← Workspace</Link><div className="mt-5"><PageHeader title="Content Studio" description="Queue product-aware posts and images. Generated work stays inside this workspace." /></div><div className="mt-8"><TenantContentPanel products={products ?? []} /></div><section className="mt-10"><h2 className="font-semibold text-ink-strong">Generated content</h2><div className="mt-3 rounded-xl border"><Table><Thead><Tr><Th>Type</Th><Th>Hook</Th><Th>Caption</Th><Th>Format</Th><Th>Status</Th></Tr></Thead><tbody>{items?.map((item) => <Tr key={item.id}><Td>{item.content_type}</Td><Td>{item.hook}</Td><Td><span className="line-clamp-2 max-w-md">{item.caption}</span></Td><Td>{item.format}</Td><Td>{item.status}</Td></Tr>)}</tbody></Table>{!items?.length && <p className="p-5 text-sm text-muted">No generated content yet.</p>}</div></section></main>;
}
