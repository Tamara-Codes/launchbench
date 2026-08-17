import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Users } from "lucide-react";
import { TenantSalesPanel } from "@/components/tenant-sales-panel";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/server/tenant-context";
import { getCurrentProject } from "@/server/current-project";

export const dynamic = "force-dynamic";
export default async function TenantSalesPage() {
  const context = await getTenantContext(); if (!context) redirect("/onboarding"); const supabase = await createClient();
  const currentProject = await getCurrentProject(context.workspace.id);
  const { data: projects } = await supabase.from("projects").select("id, name, active").eq("workspace_id", context.workspace.id).eq("active", true).order("name");
  const [{ data: territories }, { count: leadCount }, { data: projectDetail }, { data: salesAgent }] = await Promise.all([
    currentProject ? supabase.from("territories").select("id, project_id, town, country").eq("workspace_id", context.workspace.id).eq("project_id", currentProject.id).order("town") : Promise.resolve({ data: [] as { id: string; project_id: string; town: string; country: string }[] }),
    currentProject ? supabase.from("sales_leads").select("id", { count: "exact", head: true }).eq("workspace_id", context.workspace.id).eq("project_id", currentProject.id) : Promise.resolve({ count: 0 }),
    currentProject ? supabase.from("projects").select("target_customer").eq("id", currentProject.id).maybeSingle() : Promise.resolve({ data: null as { target_customer: string } | null }),
    supabase.from("workspace_agents").select("name").eq("workspace_id", context.workspace.id).eq("slug", "sales-agent").maybeSingle(),
  ]);
  const project = currentProject ? { ...currentProject, targetCustomer: projectDetail?.target_customer ?? "" } : null;
  const leads = leadCount ?? 0; const agentName = salesAgent?.name || "Sally";
  return <main className="mx-auto max-w-5xl px-6 py-14"><TenantSalesPanel currentProject={project} projects={projects ?? []} territories={territories ?? []} agentName={agentName} />{project && <Link href="/app/leads" className="mx-auto mt-8 flex max-w-3xl items-center justify-between gap-3 rounded-2xl border bg-surface p-4 shadow-sm transition-colors hover:border-accent"><span className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent"><Users className="h-4 w-4" /></span><span><span className="block text-sm font-semibold text-ink-strong">{leads === 0 ? "No leads yet" : String(leads) + " lead" + (leads === 1 ? "" : "s") + " for " + project.name}</span><span className="block text-sm text-muted">{leads === 0 ? "Run Sally to start finding businesses." : "Review and work them on the Leads page."}</span></span></span><ArrowRight className="h-4 w-4 shrink-0 text-muted" /></Link>}</main>;
}
