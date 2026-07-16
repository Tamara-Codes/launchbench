import { redirect } from "next/navigation";
import { PageHeader, Card, CardContent } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/server/tenant-context";

export const dynamic = "force-dynamic";
export default async function WorkspaceHomePage() {
  const context = await getTenantContext(); if (!context) redirect("/onboarding"); const supabase = await createClient();
  const [{ count: products }, { count: leads }, { count: content }, { count: jobs }] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }).eq("workspace_id", context.workspace.id),
    supabase.from("sales_leads").select("id", { count: "exact", head: true }).eq("workspace_id", context.workspace.id),
    supabase.from("content_items").select("id", { count: "exact", head: true }).eq("workspace_id", context.workspace.id),
    supabase.from("agent_jobs").select("id", { count: "exact", head: true }).eq("workspace_id", context.workspace.id),
  ]);
  const stats = [["Projects", products], ["Leads", leads], ["Content items", content], ["Agent jobs", jobs]];
  return <main className="mx-auto max-w-6xl px-6 py-12"><PageHeader title="Dashboard" description={`A shared view of ${context.workspace.name}.`} /><div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{stats.map(([label, count]) => <Card key={String(label)}><CardContent className="pt-5"><p className="text-sm text-muted">{label}</p><p className="mt-1 text-3xl font-semibold text-ink-strong">{count ?? 0}</p></CardContent></Card>)}</div></main>;
}
