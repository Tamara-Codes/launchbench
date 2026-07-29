import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { TenantSearchHistory, type SalesRun } from "@/components/tenant-search-history";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/server/tenant-context";

export const dynamic = "force-dynamic";
export default async function SearchHistoryPage() {
  const context = await getTenantContext(); if (!context) redirect("/onboarding"); const supabase = await createClient();
  const { data: runs } = await supabase.from("sales_runs").select("id, job_id, status, stage, error, created_at, territories(town, country), products(name)").eq("workspace_id", context.workspace.id).order("created_at", { ascending: false }).limit(100);
  const rows: SalesRun[] = (runs ?? []).map((run) => { const territory = run.territories as { town?: string; country?: string } | null; return { id: run.id, jobId: run.job_id, project: (run.products as { name?: string } | null)?.name ?? "—", territory: territory?.town ? `${territory.town}, ${territory.country ?? ""}`.replace(/, $/, "") : "—", stage: run.stage, status: run.status, error: run.error, created_at: run.created_at }; });
  return <main className="mx-auto max-w-6xl px-6 py-12"><Link className="text-sm text-accent" href="/app/sales">← Sales Agent</Link><div className="mt-5"><PageHeader title="Search History" description="Every Sales Agent run and how it turned out. Cancel one that's still in progress here." /></div><div className="mt-8"><TenantSearchHistory runs={rows} /></div></main>;
}
