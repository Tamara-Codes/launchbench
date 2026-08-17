import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, ArrowRight, CircleAlert, Images, ListChecks, Receipt } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { AgentAvatar } from "@/components/agent-avatar";
import { TodoList } from "@/components/ops-todo-list";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/server/tenant-context";
import { loadCockpit } from "@/server/ops-cockpit";
import { dayKey, monthKey, daysFromToday } from "@/lib/ops-dates";

export const dynamic = "force-dynamic";

const jobLabels: Record<string, string> = {
  lead_search: "Lead research",
  content_generation: "Content generation",
  gmail_sync: "Gmail sync",
  send_email: "Email send",
  prepare_follow_ups: "Follow-up preparation",
};

/** One item of the obligation strip. Links, so a number is never a dead end. */
function StripItem({ href, icon, children, tone = "muted" }: { href: string; icon: React.ReactNode; children: React.ReactNode; tone?: "muted" | "danger" }) {
  return (
    <Link href={href} className={`flex items-center gap-1.5 transition-colors hover:text-ink-strong ${tone === "danger" ? "text-danger" : "text-muted"}`}>
      {icon}
      {children}
    </Link>
  );
}

export default async function WorkspaceHomePage() {
  const context = await getTenantContext();
  if (!context) redirect("/onboarding");

  const cockpit = await loadCockpit(context.workspace.id);
  const supabase = await createClient();
  const { data: agents } = await supabase
    .from("workspace_agents")
    .select("slug, name, avatar_color")
    .eq("workspace_id", context.workspace.id);

  const salesAgent = agents?.find((agent) => agent.slug === "sales-agent") ?? { name: "Sales Agent", avatar_color: "blue" };
  const contentAgent = agents?.find((agent) => agent.slug === "content-agent") ?? { name: "Content Agent", avatar_color: "rose" };

  const { today, projects, counts, nextDeadline, dueTasks, upcomingTasks, unscheduledTasks, completedToday } = cockpit;
  const deadlineDays = nextDeadline ? daysFromToday(dayKey(new Date(nextDeadline.starts_at)), today) : null;
  const overdueTasks = dueTasks.filter((task) => task.due_on !== null && task.due_on < today);
  const todayTasks = dueTasks.filter((task) => task.due_on === today);

  return (
    <main className="mx-auto max-w-7xl px-6 py-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink-strong">ToDo</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="font-medium text-ink">
              {new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}
            </span>
            {nextDeadline && deadlineDays !== null && (
              <StripItem
                href={`/app/calendar?m=${monthKey(dayKey(new Date(nextDeadline.starts_at)))}`}
                icon={<Receipt className="h-3.5 w-3.5" />}
                tone={deadlineDays <= 7 ? "danger" : "muted"}
              >
                {nextDeadline.title} {deadlineDays === 0 ? "today" : `in ${deadlineDays}d`}
              </StripItem>
            )}
            {counts.overdue > 0 && (
              <span className="flex items-center gap-1.5 text-danger">
                <CircleAlert className="h-3.5 w-3.5" />
                {counts.overdue} overdue
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="mt-5 grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <TodoList
          overdueTasks={overdueTasks}
          todayTasks={todayTasks}
          upcomingTasks={upcomingTasks}
          unscheduledTasks={unscheduledTasks}
          completedTodayTasks={completedToday}
          projects={projects}
          today={today}
        />

        <div className="space-y-4">
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle>Needs attention</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-4 pt-0">
              <Link href="/app/leads" className="flex items-center justify-between rounded-lg border border-border px-3 py-2 transition-colors hover:bg-surface2">
                <span className="flex items-center gap-2 text-sm text-ink"><ListChecks className="h-4 w-4 text-accent" />Leads awaiting review</span>
                <span className="font-semibold text-ink-strong">{counts.leadsToReview}</span>
              </Link>
              <Link href="/app/content-history" className="flex items-center justify-between rounded-lg border border-border px-3 py-2 transition-colors hover:bg-surface2">
                <span className="flex items-center gap-2 text-sm text-ink"><Images className="h-4 w-4 text-accent" />Content ready to review</span>
                <span className="font-semibold text-ink-strong">{counts.contentToReview}</span>
              </Link>
            </CardContent>
          </Card>

          <div className="space-y-2">
            <Link href="/app/sales" className="group flex items-center gap-3 rounded-xl border bg-surface p-3 shadow-sm transition-colors hover:border-accent">
              <AgentAvatar name={salesAgent.name} color={salesAgent.avatar_color} size="md" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink-strong">Run {salesAgent.name}</p>
                <p className="mt-0.5 truncate text-xs text-muted">Research qualified businesses in a territory.</p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
            </Link>
            <Link href="/app/content" className="group flex items-center gap-3 rounded-xl border bg-surface p-3 shadow-sm transition-colors hover:border-accent">
              <AgentAvatar name={contentAgent.name} color={contentAgent.avatar_color} size="md" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink-strong">Run {contentAgent.name}</p>
                <p className="mt-0.5 truncate text-xs text-muted">Create project-aware social content.</p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
            </Link>
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between p-4 pb-2">
              <CardTitle>In flight</CardTitle>
              <Activity className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {cockpit.jobs.length ? (
                <div className="space-y-1">
                  {cockpit.jobs.map((job) => (
                    <Link key={job.id} href="/app/search-history" className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-surface2">
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-ink">{jobLabels[job.kind] ?? job.kind}</span>
                        <span className="mt-0.5 block truncate text-xs text-muted">
                          {job.status === "failed" && job.error ? job.error : new Date(job.created_at).toLocaleString("en-GB")}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs font-medium capitalize text-muted">{job.status}</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted">No agent runs yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
