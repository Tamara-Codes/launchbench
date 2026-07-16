import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { TenantJobList } from "@/components/tenant-job-list";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/server/tenant-context";

export const dynamic = "force-dynamic";

export default async function TenantJobsPage() {
  const context = await getTenantContext(); if (!context) redirect("/onboarding");
  const supabase = await createClient();
  const { data: jobs } = await supabase.from("agent_jobs").select("id, kind, status, attempt_count, error, created_at").eq("workspace_id", context.workspace.id).order("created_at", { ascending: false }).limit(100);
  return <main className="mx-auto max-w-4xl px-6 py-12"><Link className="text-sm text-accent" href="/app">← Workspace</Link><div className="mt-5"><PageHeader title="Agent jobs" description="Durable run history. Jobs are stored in Postgres so they survive browser closes, deployments, and worker retries." /></div><div className="mt-8"><TenantJobList jobs={jobs ?? []} /></div></main>;
}
