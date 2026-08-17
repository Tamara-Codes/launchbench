import "server-only";
import { createClient } from "@/lib/supabase/server";
import { addDays, dayKey, monthBounds } from "@/lib/ops-dates";

/**
 * One snapshot of "where the company stands right now", assembled from SQL.
 *
 * Deliberately a single function rather than queries scattered through the page:
 * the chat agent needs this exact snapshot as its per-turn context, and two
 * separate assemblies would drift until the agent contradicted the screen.
 */

export type OpsProject = { id: string; name: string };

export type OpsTaskStatus = "backlog" | "in_progress" | "done" | "dropped";

export type OpsTask = {
  id: string;
  title: string;
  status: OpsTaskStatus;
  priority: "low" | "normal" | "high";
  due_on: string | null;
  notes: string;
  project_id: string | null;
  sort_order: number;
};

export type OpsEvent = {
  id: string;
  title: string;
  kind: "meeting" | "deadline" | "tax" | "admin" | "focus";
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  location: string;
  recurrence: string;
  notes: string;
  project_id: string | null;
};

export type OpsAgentJob = { id: string; kind: string; status: string; error: string | null; created_at: string };

export type CockpitSnapshot = {
  today: string;
  horizonEnd: string;
  projects: OpsProject[];
  /** Events from the start of today through the end of the horizon. */
  events: OpsEvent[];
  /** Open tasks due today or earlier — the ones with a clock on them. */
  dueTasks: OpsTask[];
  /** Open tasks dated inside the horizon but not yet due. */
  upcomingTasks: OpsTask[];
  /** Open tasks with no date at all: the honest "what am I ignoring" pile. */
  unscheduledTasks: OpsTask[];
  /** Finished today, so the day doesn't read as pure debt. */
  completedToday: OpsTask[];
  /**
   * The next hard deadline at any distance. Separate from `events` because it is
   * usually outside the horizon — quarterly tax is the whole reason this exists,
   * and a countdown that only appears in its final week is useless.
   */
  nextDeadline: OpsEvent | null;
  counts: { overdue: number; openTotal: number; postsToday: number; leadsToReview: number; contentToReview: number };
  jobs: OpsAgentJob[];
};

/** How far ahead the cockpit looks. A week is what fits on one screen. */
const HORIZON_DAYS = 7;

export type ScheduledPost = { id: string; hook: string; content_type: string; platform: string; status: string; scheduled_for: string; project_id: string };

export type MonthSnapshot = {
  month: string;
  projects: OpsProject[];
  events: OpsEvent[];
  tasks: OpsTask[];
  /**
   * Scheduled content shown read-only. The content agent owns these rows; the
   * calendar unions them in rather than copying them, so there is still exactly
   * one home for a post.
   */
  posts: ScheduledPost[];
};

/** Everything dated inside one month, for the calendar grid. */
export async function loadMonth(workspaceId: string, month: string): Promise<MonthSnapshot> {
  const supabase = await createClient();
  const { first, last } = monthBounds(month);
  // The grid shows leading and trailing days from the neighbouring months, so
  // widen the query by a week at each end rather than leaving those cells blank.
  const from = addDays(first, -7);
  const to = addDays(last, 7);

  const [{ data: projects }, { data: events }, { data: tasks }, { data: posts }] = await Promise.all([
    supabase.from("projects").select("id, name").eq("workspace_id", workspaceId).eq("active", true).order("name"),
    supabase.from("ops_events").select("id, title, kind, starts_at, ends_at, all_day, location, recurrence, notes, project_id").eq("workspace_id", workspaceId).gte("starts_at", `${from}T00:00:00`).lte("starts_at", `${to}T23:59:59`).order("starts_at"),
    supabase.from("ops_tasks").select("id, title, status, priority, due_on, notes, project_id, sort_order").eq("workspace_id", workspaceId).neq("status", "dropped").gte("due_on", from).lte("due_on", to).order("due_on"),
    supabase.from("content_items").select("id, hook, content_type, platform, status, scheduled_for, project_id").eq("workspace_id", workspaceId).not("scheduled_for", "is", null).gte("scheduled_for", `${from}T00:00:00`).lte("scheduled_for", `${to}T23:59:59`).order("scheduled_for"),
  ]);

  return {
    month,
    projects: (projects ?? []) as OpsProject[],
    events: (events ?? []) as OpsEvent[],
    tasks: (tasks ?? []) as OpsTask[],
    posts: (posts ?? []) as ScheduledPost[],
  };
}

export async function loadCockpit(workspaceId: string): Promise<CockpitSnapshot> {
  const supabase = await createClient();
  const today = dayKey();
  const horizonEnd = addDays(today, HORIZON_DAYS);
  // Events are timestamptz, so bound them by instants; tasks are plain dates.
  const windowStart = `${today}T00:00:00`;

  const [{ data: projects }, { data: events }, { data: tasks }, { data: completedToday }, { data: nextDeadline }, { count: postsToday }, { count: leadsToReview }, { count: contentToReview }, { data: jobs }] = await Promise.all([
    supabase.from("projects").select("id, name").eq("workspace_id", workspaceId).eq("active", true).order("name"),
    supabase.from("ops_events").select("id, title, kind, starts_at, ends_at, all_day, location, recurrence, notes, project_id").eq("workspace_id", workspaceId).gte("starts_at", windowStart).lte("starts_at", `${horizonEnd}T23:59:59`).order("starts_at"),
    // "open" no longer exists as a status: backlog and in-progress tickets both
    // still carry a clock, so both count toward the dated agenda here.
    supabase.from("ops_tasks").select("id, title, status, priority, due_on, notes, project_id, sort_order").eq("workspace_id", workspaceId).in("status", ["backlog", "in_progress"]).order("due_on", { ascending: true, nullsFirst: false }),
    supabase.from("ops_tasks").select("id, title, status, priority, due_on, notes, project_id, sort_order").eq("workspace_id", workspaceId).eq("status", "done").gte("completed_at", `${today}T00:00:00`).order("completed_at", { ascending: false }),
    supabase.from("ops_events").select("id, title, kind, starts_at, ends_at, all_day, location, recurrence, notes, project_id").eq("workspace_id", workspaceId).in("kind", ["tax", "deadline"]).gte("starts_at", windowStart).order("starts_at").limit(1).maybeSingle(),
    // Reuses the content agent's own table rather than tracking posts twice.
    supabase.from("content_items").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("platform", "x").gte("scheduled_for", `${today}T00:00:00`).lte("scheduled_for", `${today}T23:59:59`),
    supabase.from("sales_leads").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "awaiting_review"),
    supabase.from("content_items").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).in("status", ["idea", "generated"]),
    supabase.from("agent_jobs").select("id, kind, status, error, created_at").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(4),
  ]);

  const openTasks = (tasks ?? []) as OpsTask[];
  // Split once here so the page never re-filters and risks a different rule.
  const dueTasks = openTasks.filter((task) => task.due_on !== null && task.due_on <= today);
  const upcomingTasks = openTasks.filter((task) => task.due_on !== null && task.due_on > today && task.due_on <= horizonEnd);
  const unscheduledTasks = openTasks.filter((task) => task.due_on === null);

  return {
    today,
    horizonEnd,
    projects: (projects ?? []) as OpsProject[],
    events: (events ?? []) as OpsEvent[],
    dueTasks,
    upcomingTasks,
    unscheduledTasks,
    completedToday: (completedToday ?? []) as OpsTask[],
    nextDeadline: (nextDeadline ?? null) as OpsEvent | null,
    counts: {
      overdue: dueTasks.filter((task) => task.due_on !== null && task.due_on < today).length,
      openTotal: openTasks.length,
      postsToday: postsToday ?? 0,
      leadsToReview: leadsToReview ?? 0,
      contentToReview: contentToReview ?? 0,
    },
    jobs: (jobs ?? []) as OpsAgentJob[],
  };
}

export type TodoBoardGroup = {
  project: OpsProject | null;
  backlog: OpsTask[];
  inProgress: OpsTask[];
  done: OpsTask[];
};

export type TodoBoardSnapshot = {
  projects: OpsProject[];
  groups: TodoBoardGroup[];
};

/** Finished tickets fall off the Done column after this long — still on the
 * task itself, just not worth scrolling past every day. */
const DONE_RETENTION_DAYS = 30;

const todoTaskColumns = "id, title, status, priority, due_on, notes, project_id, sort_order";

/** The todo board: every project's backlog/in-progress/done lanes, plus the
 * company lane (project_id null) for obligations that belong to no project. */
export async function loadTodoBoard(workspaceId: string): Promise<TodoBoardSnapshot> {
  const supabase = await createClient();
  const doneCutoff = addDays(dayKey(), -DONE_RETENTION_DAYS);

  const [{ data: projects }, { data: openTasks }, { data: doneTasks }] = await Promise.all([
    supabase.from("projects").select("id, name").eq("workspace_id", workspaceId).eq("active", true).order("name"),
    supabase.from("ops_tasks").select(todoTaskColumns).eq("workspace_id", workspaceId).in("status", ["backlog", "in_progress"]).order("sort_order"),
    supabase.from("ops_tasks").select(todoTaskColumns).eq("workspace_id", workspaceId).eq("status", "done").gte("completed_at", `${doneCutoff}T00:00:00`).order("sort_order"),
  ]);

  const activeProjects = (projects ?? []) as OpsProject[];
  const allTasks = [...((openTasks ?? []) as OpsTask[]), ...((doneTasks ?? []) as OpsTask[])];

  const groupFor = (project: OpsProject | null): TodoBoardGroup => {
    const tasksForGroup = allTasks.filter((task) => task.project_id === (project?.id ?? null));
    return {
      project,
      backlog: tasksForGroup.filter((task) => task.status === "backlog"),
      inProgress: tasksForGroup.filter((task) => task.status === "in_progress"),
      done: tasksForGroup.filter((task) => task.status === "done"),
    };
  };

  return {
    projects: activeProjects,
    groups: [...activeProjects.map((project) => groupFor(project)), groupFor(null)],
  };
}
