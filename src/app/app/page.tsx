import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, ArrowRight, CalendarClock, CircleAlert, Images, ListChecks, Receipt } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { AgentAvatar } from "@/components/agent-avatar";
import { OpsAddEvent, OpsEventRow, OpsQuickAdd, OpsTaskRow } from "@/components/ops-cockpit-panel";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/server/tenant-context";
import { loadCockpit, type OpsEvent, type OpsTask } from "@/server/ops-cockpit";
import { dayKey, daysFromToday, relativeDayLabel } from "@/lib/ops-dates";

export const dynamic = "force-dynamic";

/** Her own cadence target: 3–4 original posts a day, never zero. */
const POSTS_PER_DAY_TARGET = 4;

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

function SectionTitle({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <div className="flex items-baseline gap-2 px-1">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{children}</h2>
      {count !== undefined && count > 0 && <span className="text-xs text-muted">{count}</span>}
    </div>
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

  const { today, projects, counts, nextDeadline } = cockpit;
  const todayEvents = cockpit.events.filter((event) => dayKey(new Date(event.starts_at)) === today);

  // Everything dated inside the horizon, grouped by day, so a Thursday deadline
  // sits under the same heading as the Thursday meeting.
  const laterDays = new Map<string, { events: OpsEvent[]; tasks: OpsTask[] }>();
  const bucket = (key: string) => {
    const existing = laterDays.get(key) ?? { events: [], tasks: [] };
    laterDays.set(key, existing);
    return existing;
  };
  for (const event of cockpit.events) {
    const key = dayKey(new Date(event.starts_at));
    if (key !== today) bucket(key).events.push(event);
  }
  for (const task of cockpit.upcomingTasks) if (task.due_on) bucket(task.due_on).tasks.push(task);
  const upcomingDays = [...laterDays.entries()].sort(([a], [b]) => a.localeCompare(b));

  // The "what am I ignoring" pile, split by project. Company-level tasks last.
  const byProject = projects
    .map((project) => ({ project: project.name, tasks: cockpit.unscheduledTasks.filter((task) => task.product_id === project.id) }))
    .filter((group) => group.tasks.length > 0);
  const companyTasks = cockpit.unscheduledTasks.filter((task) => task.product_id === null);

  const deadlineDays = nextDeadline ? daysFromToday(dayKey(new Date(nextDeadline.starts_at)), today) : null;
  const dayIsEmpty = todayEvents.length === 0 && cockpit.dueTasks.length === 0;

  return (
    <main className="mx-auto max-w-7xl px-6 py-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink-strong">Today</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="font-medium text-ink">
              {new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}
            </span>
            {nextDeadline && deadlineDays !== null && (
              <span className={`flex items-center gap-1.5 ${deadlineDays <= 7 ? "text-danger" : "text-muted"}`}>
                <Receipt className="h-3.5 w-3.5" />
                {nextDeadline.title} {deadlineDays === 0 ? "today" : `in ${deadlineDays}d`}
              </span>
            )}
            <StripItem href="/app/content-calendar" icon={<CalendarClock className="h-3.5 w-3.5" />}>
              Posts today {counts.postsToday}/{POSTS_PER_DAY_TARGET}
            </StripItem>
            {counts.overdue > 0 && (
              <span className="flex items-center gap-1.5 text-danger">
                <CircleAlert className="h-3.5 w-3.5" />
                {counts.overdue} overdue
              </span>
            )}
            <span className="text-muted">{counts.openTotal} open</span>
          </div>
        </div>
        <OpsAddEvent projects={projects} defaultDate={today} />
      </header>

      <div className="mt-5 grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle>Today</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-4 pt-0">
              {dayIsEmpty ? (
                <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted">
                  Nothing scheduled and nothing due. Add the first thing below.
                </p>
              ) : (
                <ul className="-mx-2">
                  {todayEvents.map((event) => <OpsEventRow key={event.id} event={event} projects={projects} />)}
                  {cockpit.dueTasks.map((task) => <OpsTaskRow key={task.id} task={task} projects={projects} today={today} />)}
                </ul>
              )}
              <OpsQuickAdd projects={projects} defaultDue={today} />
              {cockpit.completedToday.length > 0 && (
                <details className="px-2">
                  <summary className="cursor-pointer text-xs text-muted hover:text-ink">
                    {cockpit.completedToday.length} done today
                  </summary>
                  <ul className="-mx-2 mt-1">
                    {cockpit.completedToday.map((task) => <OpsTaskRow key={task.id} task={task} projects={projects} today={today} />)}
                  </ul>
                </details>
              )}
            </CardContent>
          </Card>

          <section className="space-y-2">
            <SectionTitle>Next 7 days</SectionTitle>
            {upcomingDays.length === 0 ? (
              <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted">The week ahead is clear.</p>
            ) : (
              <Card>
                <CardContent className="space-y-3 p-4">
                  {upcomingDays.map(([key, group]) => (
                    <div key={key}>
                      <p className="px-2 text-xs font-semibold text-ink-strong">{relativeDayLabel(key, today)}</p>
                      <ul className="-mx-2 mt-0.5">
                        {group.events.map((event) => <OpsEventRow key={event.id} event={event} projects={projects} />)}
                        {group.tasks.map((task) => <OpsTaskRow key={task.id} task={task} projects={projects} today={today} />)}
                      </ul>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </section>

          <section className="space-y-2">
            <SectionTitle count={cockpit.unscheduledTasks.length}>Unscheduled</SectionTitle>
            {cockpit.unscheduledTasks.length === 0 ? (
              <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted">
                Nothing undated — every open task has a day.
              </p>
            ) : (
              <Card>
                <CardContent className="space-y-3 p-4">
                  {byProject.map((group) => (
                    <div key={group.project}>
                      <p className="px-2 text-xs font-semibold text-ink-strong">{group.project}</p>
                      <ul className="-mx-2 mt-0.5">
                        {group.tasks.map((task) => <OpsTaskRow key={task.id} task={task} projects={projects} today={today} showProject={false} />)}
                      </ul>
                    </div>
                  ))}
                  {companyTasks.length > 0 && (
                    <div>
                      <p className="px-2 text-xs font-semibold text-ink-strong">Company</p>
                      <ul className="-mx-2 mt-0.5">
                        {companyTasks.map((task) => <OpsTaskRow key={task.id} task={task} projects={projects} today={today} showProject={false} />)}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </section>
        </div>

        {/* Step 2 replaces this column with the chat panel and moves these three
            compact blocks to the foot of the left column. */}
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
