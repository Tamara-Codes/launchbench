import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader, Table, Td, Th, Thead, Tr } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/server/tenant-context";

export const dynamic = "force-dynamic";
export default async function ContentCalendarPage() {
  const context = await getTenantContext(); if (!context) redirect("/onboarding"); const supabase = await createClient();
  const { data: items } = await supabase.from("content_items").select("id, content_type, hook, platform, format, status, scheduled_for, products(name)").eq("workspace_id", context.workspace.id).not("scheduled_for", "is", null).order("scheduled_for").limit(200);
  return <main className="mx-auto max-w-6xl px-6 py-12"><Link className="text-sm text-accent" href="/app/content">← Content Agent</Link><div className="mt-5"><PageHeader title="Content Calendar" description="Scheduled content across your projects." /></div><div className="mt-8 overflow-hidden rounded-xl border"><Table><Thead><Tr><Th>When</Th><Th>Project</Th><Th>Content</Th><Th>Format</Th><Th>Status</Th></Tr></Thead><tbody>{items?.map((item) => <Tr key={item.id}><Td>{item.scheduled_for ? new Date(item.scheduled_for).toLocaleString() : "—"}</Td><Td>{(item.products as { name?: string } | null)?.name ?? "—"}</Td><Td>{item.hook || item.content_type}</Td><Td>{item.format}</Td><Td>{item.status}</Td></Tr>)}</tbody></Table>{!items?.length && <p className="p-5 text-sm text-muted">No content is scheduled yet.</p>}</div></main>;
}
