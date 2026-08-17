"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, CheckCircle2, PlayCircle, Plus, Trash2 } from "lucide-react";
import { Badge, Input } from "./ui";
import { Select } from "./ui-select";
import { toast } from "./toast";
import { TaskEditForm } from "./ops-task-edit-form";
import { cn } from "@/lib/utils";
import { createOpsTask, deleteOpsTask, setOpsTaskStatus } from "@/server/ops-actions";
import { relativeDayLabel } from "@/lib/ops-dates";
import type { OpsProject, OpsTask } from "@/server/ops-cockpit";

/** Deterministic so the same project always gets the same dot color, without
 * storing a color on the project row. */
const PILL_DOT_COLORS = ["bg-emerald-500", "bg-blue-500", "bg-violet-500", "bg-rose-500", "bg-amber-500", "bg-cyan-500"];
function pillDotColor(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) hash = (hash * 31 + id.charCodeAt(index)) | 0;
  return PILL_DOT_COLORS[Math.abs(hash) % PILL_DOT_COLORS.length];
}

function ProjectPill({ project }: { project: OpsProject | null }) {
  if (!project) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-xs text-muted">
        <span className="h-1.5 w-1.5 rounded-full bg-muted" />
        Company
      </span>
    );
  }
  return (
    <Link
      href={`/app/projects/${project.id}/tasks`}
      onClick={(event) => event.stopPropagation()}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-xs text-muted transition-colors hover:border-accent hover:text-ink"
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", pillDotColor(project.id))} />
      {project.name}
    </Link>
  );
}

function TodoRow({
  task,
  project,
  projects,
  today,
  editing,
  onSetStatus,
  onDelete,
  onEdit,
  onCloseEdit,
}: {
  task: OpsTask;
  project: OpsProject | null;
  projects: OpsProject[];
  today: string;
  editing: boolean;
  onSetStatus: (status: "backlog" | "in_progress" | "done") => void;
  onDelete: () => void;
  onEdit: () => void;
  onCloseEdit: () => void;
}) {
  if (editing) return <li><TaskEditForm task={task} projects={projects} onClose={onCloseEdit} minimal /></li>;
  const done = task.status === "done";
  const inProgress = task.status === "in_progress";

  return (
    <li
      className={cn(
        "group flex items-center gap-2.5 rounded-lg border px-2.5 py-2 transition-colors",
        inProgress ? "border-success/40 bg-success-soft" : "border-border bg-surface",
      )}
    >
      {/* Independent of the done checkbox, and always reversible with a second
       * click — a one-way cycle through this state was the thing she disliked. */}
      {!done && (
        <button
          type="button"
          aria-label={inProgress ? `Stop working on "${task.title}"` : `Start working on "${task.title}"`}
          aria-pressed={inProgress}
          onClick={() => onSetStatus(inProgress ? "backlog" : "in_progress")}
          className={cn("shrink-0 transition-colors", inProgress ? "text-success" : "text-muted hover:text-ink")}
        >
          <PlayCircle className="h-4 w-4" />
        </button>
      )}
      <button
        type="button"
        aria-label={done ? `Mark "${task.title}" not done` : `Mark "${task.title}" done`}
        onClick={() => onSetStatus(done ? "backlog" : "done")}
        className="shrink-0 text-muted transition-colors hover:text-ink"
      >
        {done ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Check className="h-4 w-4" />}
      </button>
      <button
        type="button"
        onClick={onEdit}
        className={cn("min-w-0 flex-1 truncate text-left text-sm text-ink hover:underline", done && "text-muted line-through")}
      >
        {task.title}
      </button>
      {task.priority === "high" && !done && <Badge tone="danger">High</Badge>}
      {task.due_on && <span className="shrink-0 text-xs text-muted">{relativeDayLabel(task.due_on, today)}</span>}
      <ProjectPill project={project} />
      <button
        type="button"
        aria-label={`Delete "${task.title}"`}
        onClick={onDelete}
        className="shrink-0 rounded p-1 text-muted opacity-0 transition-opacity hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}

function Section({
  title,
  tasks,
  projectFor,
  projects,
  today,
  editingId,
  onSetStatus,
  onDelete,
  onEdit,
  onCloseEdit,
}: {
  title: string;
  tasks: OpsTask[];
  projectFor: (task: OpsTask) => OpsProject | null;
  projects: OpsProject[];
  today: string;
  editingId: string | null;
  onSetStatus: (id: string, status: "backlog" | "in_progress" | "done") => void;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  onCloseEdit: () => void;
}) {
  if (!tasks.length) return null;
  return (
    <div className="space-y-1.5">
      <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">{title} <span className="text-muted/70">{tasks.length}</span></p>
      <ul className="space-y-1.5">
        {tasks.map((task) => (
          <TodoRow
            key={task.id}
            task={task}
            project={projectFor(task)}
            projects={projects}
            today={today}
            editing={editingId === task.id}
            onSetStatus={(status) => onSetStatus(task.id, status)}
            onDelete={() => onDelete(task.id)}
            onEdit={() => onEdit(task.id)}
            onCloseEdit={onCloseEdit}
          />
        ))}
      </ul>
    </div>
  );
}

const PRIORITY_RANK: Record<OpsTask["priority"], number> = { high: 0, normal: 1, low: 2 };

/** Unscheduled tickets have no date to sort by, and a flat pile of them across
 * every project just reads as noise — cluster by project first (alphabetical,
 * company-level obligations last since they're the odd one out), then by
 * priority within each project so nothing needs a second pass to find. */
function groupByProject(tasks: OpsTask[], projects: OpsProject[]): { project: OpsProject | null; tasks: OpsTask[] }[] {
  const sorted = [...tasks].sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.title.localeCompare(b.title));
  const byProjectId = new Map<string | null, OpsTask[]>();
  for (const task of sorted) {
    const key = task.project_id;
    const bucket = byProjectId.get(key);
    if (bucket) bucket.push(task); else byProjectId.set(key, [task]);
  }
  const groups: { project: OpsProject | null; tasks: OpsTask[] }[] = projects
    .filter((project) => byProjectId.has(project.id))
    .map((project) => ({ project, tasks: byProjectId.get(project.id)! }));
  const companyTasks = byProjectId.get(null);
  if (companyTasks) groups.push({ project: null, tasks: companyTasks });
  return groups;
}

function UnscheduledSection({
  tasks,
  projects,
  today,
  editingId,
  onSetStatus,
  onDelete,
  onEdit,
  onCloseEdit,
}: {
  tasks: OpsTask[];
  projects: OpsProject[];
  today: string;
  editingId: string | null;
  onSetStatus: (id: string, status: "backlog" | "in_progress" | "done") => void;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  onCloseEdit: () => void;
}) {
  if (!tasks.length) return null;
  const groups = groupByProject(tasks, projects);
  return (
    <div className="space-y-2.5">
      <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">Unscheduled <span className="text-muted/70">{tasks.length}</span></p>
      {groups.map((group) => (
        <div key={group.project?.id ?? "company"} className="space-y-1.5">
          <div className="px-1"><ProjectPill project={group.project} /></div>
          <ul className="space-y-1.5">
            {group.tasks.map((task) => (
              <TodoRow
                key={task.id}
                task={task}
                project={group.project}
                projects={projects}
                today={today}
                editing={editingId === task.id}
                onSetStatus={(status) => onSetStatus(task.id, status)}
                onDelete={() => onDelete(task.id)}
                onEdit={() => onEdit(task.id)}
                onCloseEdit={onCloseEdit}
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Fires `onAdd` the instant the title is entered — the caller inserts an
 * optimistic row immediately rather than waiting on the round trip. */
function AddTicket({ projects, onAdd }: { projects: OpsProject[]; onAdd: (title: string, projectId: string) => void }) {
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState("none");

  function submit() {
    const trimmed = title.trim();
    if (!trimmed) return;
    setTitle("");
    onAdd(trimmed, projectId);
  }

  return (
    <form onSubmit={(event) => { event.preventDefault(); submit(); }} className="flex items-center gap-1.5 rounded-lg border border-dashed border-border px-2.5 py-1.5">
      <Plus className="h-3.5 w-3.5 shrink-0 text-muted" />
      <Input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Add a ticket…"
        className="h-7 border-0 bg-transparent px-1 text-sm focus-visible:ring-0"
      />
      <Select
        value={projectId}
        onChange={(event) => setProjectId(event.target.value)}
        className="h-7 w-auto shrink-0 gap-1.5 rounded-md border-border px-1.5 py-1 text-xs font-normal text-muted shadow-none"
      >
        <option value="none">Company</option>
        {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
      </Select>
    </form>
  );
}

export function TodoList({
  overdueTasks,
  todayTasks,
  upcomingTasks,
  unscheduledTasks,
  completedTodayTasks,
  projects,
  today,
}: {
  overdueTasks: OpsTask[];
  todayTasks: OpsTask[];
  upcomingTasks: OpsTask[];
  unscheduledTasks: OpsTask[];
  completedTodayTasks: OpsTask[];
  projects: OpsProject[];
  today: string;
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState(() => [...overdueTasks, ...todayTasks, ...upcomingTasks, ...unscheduledTasks, ...completedTodayTasks]);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Props are fresh arrays on every server render (add/edit/status change) —
  // reconcile local optimistic state against them during render, the same
  // pattern the project board uses, so a refresh can't flash stale state.
  const [synced, setSynced] = useState({ overdueTasks, todayTasks, upcomingTasks, unscheduledTasks, completedTodayTasks });
  if (
    synced.overdueTasks !== overdueTasks ||
    synced.todayTasks !== todayTasks ||
    synced.upcomingTasks !== upcomingTasks ||
    synced.unscheduledTasks !== unscheduledTasks ||
    synced.completedTodayTasks !== completedTodayTasks
  ) {
    setSynced({ overdueTasks, todayTasks, upcomingTasks, unscheduledTasks, completedTodayTasks });
    setTasks([...overdueTasks, ...todayTasks, ...upcomingTasks, ...unscheduledTasks, ...completedTodayTasks]);
  }

  // Done tasks get their own section further down rather than vanishing —
  // unchecking one there is the "step back" undo, and it drops straight back
  // into whichever bucket its due date puts it in.
  const buckets = useMemo(() => ({
    overdue: tasks.filter((task) => task.status !== "done" && task.due_on !== null && task.due_on < today),
    today: tasks.filter((task) => task.status !== "done" && task.due_on === today),
    upcoming: tasks.filter((task) => task.status !== "done" && task.due_on !== null && task.due_on > today),
    unscheduled: tasks.filter((task) => task.status !== "done" && task.due_on === null),
    done: tasks.filter((task) => task.status === "done"),
  }), [tasks, today]);

  const projectFor = (task: OpsTask) => projects.find((project) => project.id === task.project_id) ?? null;
  const empty = tasks.length === 0;

  function setStatus(id: string, status: "backlog" | "in_progress" | "done") {
    setTasks((prev) => prev.map((candidate) => (candidate.id === id ? { ...candidate, status } : candidate)));
    void setOpsTaskStatus(id, status).then((result) => {
      if (!result.ok) toast(result.error, "error");
      router.refresh();
    });
  }

  function remove(id: string) {
    setTasks((prev) => prev.filter((candidate) => candidate.id !== id));
    void deleteOpsTask(id).then((result) => {
      if (!result.ok) toast(result.error, "error");
      router.refresh();
    });
  }

  function addTicket(title: string, projectId: string) {
    const placeholder: OpsTask = {
      id: `pending-${crypto.randomUUID()}`,
      title,
      status: "backlog",
      priority: "normal",
      due_on: null,
      notes: "",
      project_id: projectId === "none" ? null : projectId,
      sort_order: tasks.length,
    };
    setTasks((prev) => [...prev, placeholder]);
    void createOpsTask({ title, projectId, dueOn: "", priority: "normal", notes: "" }).then((result) => {
      if (!result.ok) toast(result.error, "error");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-surface p-3">
      <AddTicket projects={projects} onAdd={addTicket} />
      {empty && <p className="px-1 text-sm text-muted">Nothing open. Good spot to be in.</p>}
      <Section title="Overdue" tasks={buckets.overdue} projectFor={projectFor} projects={projects} today={today} editingId={editingId} onSetStatus={setStatus} onDelete={remove} onEdit={setEditingId} onCloseEdit={() => setEditingId(null)} />
      <Section title="Today" tasks={buckets.today} projectFor={projectFor} projects={projects} today={today} editingId={editingId} onSetStatus={setStatus} onDelete={remove} onEdit={setEditingId} onCloseEdit={() => setEditingId(null)} />
      <Section title="Upcoming" tasks={buckets.upcoming} projectFor={projectFor} projects={projects} today={today} editingId={editingId} onSetStatus={setStatus} onDelete={remove} onEdit={setEditingId} onCloseEdit={() => setEditingId(null)} />
      <UnscheduledSection tasks={buckets.unscheduled} projects={projects} today={today} editingId={editingId} onSetStatus={setStatus} onDelete={remove} onEdit={setEditingId} onCloseEdit={() => setEditingId(null)} />
      <Section title="Done today" tasks={buckets.done} projectFor={projectFor} projects={projects} today={today} editingId={editingId} onSetStatus={setStatus} onDelete={remove} onEdit={setEditingId} onCloseEdit={() => setEditingId(null)} />
    </div>
  );
}
