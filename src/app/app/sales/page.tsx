import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Users } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { TenantSalesPanel } from "@/components/tenant-sales-panel";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/server/tenant-context";
import { getCurrentProject } from "@/server/current-project";

export const dynamic = "force-dynamic";
export default async function TenantSalesPage() {
  const context = await getTenantContext(); if (!context) redirect("/onboarding"); const supabase = await createClient();
  const currentProject = await getCurrentProject(context.workspace.id);
  const [{ data: territories }, { count: leadCount }, { data: projectDetail }] = await Promise.all([
    currentProject
      ? supabase.from("territories").select("id, product_id, town, country").eq("workspace_id", context.workspace.id).eq("product_id", currentProject.id).order("town")
      : Promise.resolve({ data: [] as { id: string; product_id: string; town: string; country: string }[] }),
    currentProject
      ? supabase.from("sales_leads").select("id", { count: "exact", head: true }).eq("workspace_id", context.workspace.id).eq("product_id", currentProject.id)
      : Promise.resolve({ count: 0 }),
    currentProject
      ? supabase.from("products").select("target_customer").eq("id", currentProject.id).maybeSingle()
      : Promise.resolve({ data: null as { target_customer: string } | null }),
  ]);
  const project = currentProject ? { ...currentProject, targetCustomer: projectDetail?.target_customer ?? "" } : null;
  const leads = leadCount ?? 0;
  return <main className="mx-auto max-w-6xl px-6 py-12"><Link className="text-sm text-accent" href="/app">← Workspace</Link><div className="mt-5"><PageHeader title="Sales Agent" description={project ? `Find leads for ${project.name}: pick a territory and let the agent research and qualify businesses in it.` : "Pick a territory and let the agent research and qualify businesses in it."} /></div><div className="mt-8"><TenantSalesPanel currentProject={project} territories={territories ?? []} /></div>{project && <Link href="/app/leads" className="mx-auto mt-8 flex max-w-xl items-center justify-between gap-3 rounded-2xl border bg-surface p-4 shadow-sm transition-colors hover:border-accent"><span className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent"><Users className="h-4 w-4" /></span><span><span className="block text-sm font-semibold text-ink-strong">{leads === 0 ? "No leads yet" : `${leads} lead${leads === 1 ? "" : "s"} for ${project.name}`}</span><span className="block text-sm text-muted">{leads === 0 ? "Run the agent to start finding businesses." : "Review and work them on the Leads page."}</span></span></span><ArrowRight className="h-4 w-4 shrink-0 text-muted" /></Link>}</main>;
}
