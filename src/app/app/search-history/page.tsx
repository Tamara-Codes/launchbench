import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader, Table, Td, Th, Thead, Tr } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/server/tenant-context";

export const dynamic = "force-dynamic";
export default async function SearchHistoryPage() {
  const context = await getTenantContext(); if (!context) redirect("/onboarding"); const supabase = await createClient();
  const { data: runs } = await supabase.from("sales_runs").select("id, status, stage, stats, error, created_at, completed_at, territories(town, country), products(name)").eq("workspace_id", context.workspace.id).order("created_at", { ascending: false }).limit(100);
  return <main className="mx-auto max-w-6xl px-6 py-12"><Link className="text-sm text-accent" href="/app/sales">← Sales Agent</Link><div className="mt-5"><PageHeader title="Search History" description="Durable Sales Agent runs and their outcomes." /></div><div className="mt-8 overflow-hidden rounded-xl border"><Table><Thead><Tr><Th>Project</Th><Th>Territory</Th><Th>Stage</Th><Th>Status</Th><Th>Started</Th></Tr></Thead><tbody>{runs?.map((run) => <Tr key={run.id}><Td>{(run.products as { name?: string } | null)?.name ?? "—"}</Td><Td>{(run.territories as { town?: string; country?: string } | null)?.town ?? "—"}</Td><Td>{run.stage}</Td><Td>{run.error || run.status}</Td><Td>{new Date(run.created_at).toLocaleDateString()}</Td></Tr>)}</tbody></Table>{!runs?.length && <p className="p-5 text-sm text-muted">No Sales Agent runs have been recorded yet.</p>}</div></main>;
}
