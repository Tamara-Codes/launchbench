import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader, Table, Td, Th, Thead, Tr } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/server/tenant-context";

export const dynamic = "force-dynamic";
export default async function ContentHistoryPage() {
  const context = await getTenantContext(); if (!context) redirect("/onboarding"); const supabase = await createClient();
  const { data: items } = await supabase.from("content_items").select("id, content_type, hook, platform, format, status, created_at, products(name)").eq("workspace_id", context.workspace.id).order("created_at", { ascending: false }).limit(200);
  return <main className="mx-auto max-w-6xl px-6 py-12"><Link className="text-sm text-accent" href="/app/content">← Content Agent</Link><div className="mt-5"><PageHeader title="Content History" description="Every generated content item retained in this workspace." /></div><div className="mt-8 overflow-hidden rounded-xl border"><Table><Thead><Tr><Th>Created</Th><Th>Project</Th><Th>Content</Th><Th>Platform</Th><Th>Status</Th></Tr></Thead><tbody>{items?.map((item) => <Tr key={item.id}><Td>{new Date(item.created_at).toLocaleDateString()}</Td><Td>{(item.products as { name?: string } | null)?.name ?? "—"}</Td><Td>{item.hook || item.content_type}</Td><Td>{item.platform} · {item.format}</Td><Td>{item.status}</Td></Tr>)}</tbody></Table>{!items?.length && <p className="p-5 text-sm text-muted">No generated content yet.</p>}</div></main>;
}
