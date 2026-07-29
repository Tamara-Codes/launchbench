import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants, PageHeader } from "@/components/ui";
import { OpsMonthGrid } from "@/components/ops-month-grid";
import { getTenantContext } from "@/server/tenant-context";
import { loadMonth, type OpsEvent, type OpsTask, type ScheduledPost } from "@/server/ops-cockpit";
import { addMonths, dayKey, monthGridDays, monthKey, monthLabel } from "@/lib/ops-dates";

export const dynamic = "force-dynamic";

/** Legend entries mirror the dot colours in the grid. */
const legend = [
  { label: "Meeting", className: "bg-accent" },
  { label: "Deadline", className: "bg-danger" },
  { label: "Tax", className: "bg-warning" },
  { label: "Admin", className: "bg-muted" },
  { label: "Focus", className: "bg-info" },
];

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const context = await getTenantContext();
  if (!context) redirect("/onboarding");

  const today = dayKey();
  const requested = (await searchParams).m;
  // Ignore anything that is not a real month key rather than throwing on a
  // hand-edited URL.
  const month = requested && /^\d{4}-(0[1-9]|1[0-2])$/.test(requested) ? requested : monthKey(today);

  const { events, tasks, posts, projects } = await loadMonth(context.workspace.id, month);
  const days = monthGridDays(month);

  // Bucket once on the server so the grid does no filtering per cell.
  const content: Record<string, { events: OpsEvent[]; tasks: OpsTask[]; posts: ScheduledPost[] }> = {};
  const cell = (key: string) => (content[key] ??= { events: [], tasks: [], posts: [] });
  for (const event of events) cell(dayKey(new Date(event.starts_at))).events.push(event);
  for (const task of tasks) if (task.due_on) cell(task.due_on).tasks.push(task);
  for (const post of posts) cell(dayKey(new Date(post.scheduled_for))).posts.push(post);

  const total = events.length + tasks.length + posts.length;

  return (
    <main className="mx-auto max-w-7xl px-6 py-6">
      <PageHeader
        title="Calendar"
        description="Every obligation, dated task, and scheduled post across all projects."
        actions={
          <div className="flex items-center gap-1.5">
            <Link href={`/app/calendar?m=${addMonths(month, -1)}`} aria-label="Previous month" className={buttonVariants({ variant: "outline", size: "icon" })}>
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <Link href="/app/calendar" className={buttonVariants({ variant: "outline", size: "sm" })}>Today</Link>
            <Link href={`/app/calendar?m=${addMonths(month, 1)}`} aria-label="Next month" className={buttonVariants({ variant: "outline", size: "icon" })}>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        }
      />

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight text-ink-strong">{monthLabel(month)}</h2>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
          {legend.map((entry) => (
            <span key={entry.label} className="flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${entry.className}`} />
              {entry.label}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-sm border border-muted" />
            Task
          </span>
          <span className="flex items-center gap-1.5">
            <span className="font-semibold uppercase">X</span>
            Scheduled post
          </span>
        </div>
      </div>

      <div className="mt-3">
        <OpsMonthGrid month={month} days={days} today={today} content={content} projects={projects} />
      </div>

      {total === 0 && (
        <p className="mt-3 text-sm text-muted">
          Nothing dated this month. Hover a day and press + to add an obligation.
        </p>
      )}
    </main>
  );
}
