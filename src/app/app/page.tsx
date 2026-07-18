import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, ArrowRight, Clock3, FolderPlus, Images, ListChecks, MapPinned, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, PageHeader } from "@/components/ui";
import { AgentAvatar } from "@/components/agent-avatar";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/server/tenant-context";

export const dynamic = "force-dynamic";

const jobLabels: Record<string, string> = {
  lead_search: "Lead research",
  content_generation: "Content generation",
  gmail_sync: "Gmail sync",
  send_email: "Email send",
  prepare_follow_ups: "Follow-up preparation",
};

function formatJobStatus(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default async function WorkspaceHomePage() {
  const context = await getTenantContext();
  if (!context) redirect("/onboarding");

  const supabase = await createClient();
  const [{ count: products }, { count: activeTerritories }, { count: leads }, { count: content }, { count: leadsToReview }, { count: contentToReview }, { count: activeJobs }, { data: jobs }, { data: agents }] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }).eq("workspace_id", context.workspace.id),
    supabase.from("territories").select("id", { count: "exact", head: true }).eq("workspace_id", context.workspace.id).eq("active", true),
    supabase.from("sales_leads").select("id", { count: "exact", head: true }).eq("workspace_id", context.workspace.id),
    supabase.from("content_items").select("id", { count: "exact", head: true }).eq("workspace_id", context.workspace.id),
    supabase.from("sales_leads").select("id", { count: "exact", head: true }).eq("workspace_id", context.workspace.id).eq("status", "awaiting_review"),
    supabase.from("content_items").select("id", { count: "exact", head: true }).eq("workspace_id", context.workspace.id).in("status", ["idea", "generated"]),
    supabase.from("agent_jobs").select("id", { count: "exact", head: true }).eq("workspace_id", context.workspace.id).in("status", ["queued", "running"]),
    supabase.from("agent_jobs").select("id, kind, status, error, created_at").eq("workspace_id", context.workspace.id).order("created_at", { ascending: false }).limit(3),
    supabase.from("workspace_agents").select("slug, name, avatar_color").eq("workspace_id", context.workspace.id),
  ]);

  const salesAgent = agents?.find((agent) => agent.slug === "sales-agent") ?? { name: "Sales Agent", avatar_color: "blue" };
  const contentAgent = agents?.find((agent) => agent.slug === "content-agent") ?? { name: "Content Agent", avatar_color: "rose" };
  const hasProjects = (products ?? 0) > 0;
  const hasTerritory = (activeTerritories ?? 0) > 0;
  const nextStep = !hasProjects
    ? { icon: FolderPlus, title: "Add your first project", description: "Projects give both agents the context they need to work for you.", href: "/app/products/new", label: "Add project" }
    : !hasTerritory
      ? { icon: MapPinned, title: "Choose a territory", description: "Set an active territory before asking your sales agent to find leads.", href: "/app/settings", label: "Set territory" }
      : { icon: Sparkles, title: "Your workspace is ready", description: "Start with lead research or create your next piece of content.", href: "/app/sales", label: "Find leads" };
  const NextStepIcon = nextStep.icon;
  const stats = [
    { label: "Projects", value: products ?? 0, href: "/app/products" },
    { label: "Leads found", value: leads ?? 0, href: "/app/leads" },
    { label: "Content created", value: content ?? 0, href: "/app/content-history" },
    { label: "Jobs in progress", value: activeJobs ?? 0, href: "/app" },
  ];

  return <main className="mx-auto max-w-6xl px-6 py-6 lg:h-[100dvh] lg:overflow-hidden"><PageHeader title="Dashboard" description={`A clear view of what needs attention in ${context.workspace.name}.`} /><section className="mt-5 grid gap-3 lg:grid-cols-[1.35fr_1fr]"><Card className="border-accent/35 bg-accent-soft/35"><CardContent className="flex min-h-32 flex-col justify-between pt-4"><div className="flex items-start gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-fg"><NextStepIcon className="h-4 w-4" /></div><div><p className="text-sm font-semibold text-ink-strong">Next step</p><h2 className="mt-1 text-lg font-semibold tracking-tight text-ink-strong">{nextStep.title}</h2><p className="mt-1 max-w-lg text-sm text-muted">{nextStep.description}</p></div></div><Link href={nextStep.href} className="mt-3 inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-accent hover:underline">{nextStep.label}<ArrowRight className="h-4 w-4" /></Link></CardContent></Card><Card><CardHeader className="p-4 pb-2"><CardTitle>Needs attention</CardTitle></CardHeader><CardContent className="space-y-2 p-4 pt-0"><Link href="/app/leads" className="flex items-center justify-between rounded-lg border border-border px-3 py-2 transition-colors hover:bg-surface2"><span className="flex items-center gap-2 text-sm text-ink"><ListChecks className="h-4 w-4 text-accent" />Leads awaiting review</span><span className="font-semibold text-ink-strong">{leadsToReview ?? 0}</span></Link><Link href="/app/content-history" className="flex items-center justify-between rounded-lg border border-border px-3 py-2 transition-colors hover:bg-surface2"><span className="flex items-center gap-2 text-sm text-ink"><Images className="h-4 w-4 text-accent" />Content ready to review</span><span className="font-semibold text-ink-strong">{contentToReview ?? 0}</span></Link></CardContent></Card></section><section className="mt-3 grid gap-3 md:grid-cols-2"><Link href="/app/sales" className="group rounded-xl border bg-surface p-4 shadow-sm transition-colors hover:border-accent"><div className="flex items-center gap-4"><AgentAvatar name={salesAgent.name} color={salesAgent.avatar_color} size="md" /><div className="min-w-0"><div className="flex items-start justify-between gap-3"><h2 className="text-base font-semibold text-ink-strong">Run {salesAgent.name}</h2><ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent" /></div><p className="mt-1 text-sm text-muted">Research qualified businesses in your selected territory.</p></div></div></Link><Link href="/app/content" className="group rounded-xl border bg-surface p-4 shadow-sm transition-colors hover:border-accent"><div className="flex items-center gap-4"><AgentAvatar name={contentAgent.name} color={contentAgent.avatar_color} size="md" /><div className="min-w-0"><div className="flex items-start justify-between gap-3"><h2 className="text-base font-semibold text-ink-strong">Run {contentAgent.name}</h2><ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent" /></div><p className="mt-1 text-sm text-muted">Create product-aware social media content for a project.</p></div></div></Link></section><section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{stats.map((stat) => <Link key={stat.label} href={stat.href}><Card className="h-full transition-colors hover:border-accent"><CardContent className="p-4"><p className="text-sm text-muted">{stat.label}</p><p className="mt-1 text-2xl font-semibold text-ink-strong">{stat.value}</p></CardContent></Card></Link>)}</section><section className="mt-4"><Card><CardHeader className="flex-row items-center justify-between p-4 pb-2"><div><CardTitle>Recent activity</CardTitle><p className="mt-1 text-sm text-muted">The latest work requested in this workspace.</p></div><Activity className="h-4 w-4 text-accent" /></CardHeader><CardContent className="p-4 pt-0">{jobs?.length ? <div className="space-y-1">{jobs.map((job) => <div key={job.id} className="flex items-center justify-between gap-4 rounded-lg px-3 py-2 hover:bg-surface2"><div className="min-w-0"><p className="truncate text-sm font-medium text-ink">{jobLabels[job.kind] ?? job.kind}</p><p className="mt-0.5 truncate text-xs text-muted">{job.status === "failed" && job.error ? job.error : new Date(job.created_at).toLocaleString()}</p></div><span className="shrink-0 text-xs font-medium text-muted">{formatJobStatus(job.status)}</span></div>)}</div> : <div className="flex items-center gap-3 rounded-lg border border-dashed px-4 py-4"><Clock3 className="h-5 w-5 text-muted" /><div><p className="text-sm font-medium text-ink">No activity yet</p><p className="mt-0.5 text-sm text-muted">Run an agent to see its work appear here.</p></div></div>}</CardContent></Card></section></main>;
}
