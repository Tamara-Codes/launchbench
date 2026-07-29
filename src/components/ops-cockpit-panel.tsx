"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Check, Loader2, Plus, Trash2, X } from "lucide-react";
import { Badge, Button, Input, Label, Textarea } from "./ui";
import { Select } from "./ui-select";
import { toast } from "./toast";
import { cn } from "@/lib/utils";
import { createOpsEvent, createOpsTask, deleteOpsEvent, deleteOpsTask, setOpsTaskStatus } from "@/server/ops-actions";
import { daysFromToday, timeLabel } from "@/lib/ops-dates";
import type { OpsEvent, OpsProject, OpsTask } from "@/server/ops-cockpit";

type ActionResult<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

/**
 * Radix Select refuses an empty-string item value (it reserves "" for the
 * placeholder), so "belongs to no project" travels as a sentinel the action
 * layer knows how to read.
 */
const NO_PROJECT = "none";

/** Shared plumbing: run a server action, surface failures, refresh the page. */
function useAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<ActionResult>, onDone?: () => void) {
    setBusy(true);
    try {
      const result = await action();
      if (!result.ok) { toast(result.error, "error"); return false; }
      onDone?.();
      startTransition(() => router.refresh());
      return true;
    } catch (error) {
      toast(error instanceof Error ? error.message : "Unexpected error", "error");
      return false;
    } finally {
      setBusy(false);
    }
  }

  return { run, loading: busy || pending };
}

const priorityTone = { high: "danger", normal: "neutral", low: "neutral" } as const;

const kindTone = { meeting: "accent", deadline: "danger", tax: "warning", admin: "neutral", focus: "info" } as const;
const kindLabel = { meeting: "Meeting", deadline: "Deadline", tax: "Tax", admin: "Admin", focus: "Focus" } as const;

function projectName(projects: OpsProject[], id: string | null) {
  return id ? projects.find((project) => project.id === id)?.name : undefined;
}

// --------------------------------------------------------------------------
// Task row — a checkbox, not a button, because completing is the common action
// --------------------------------------------------------------------------
export function OpsTaskRow({ task, projects, today, showProject = true }: { task: OpsTask; projects: OpsProject[]; today: string; showProject?: boolean }) {
  const { run, loading } = useAction();
  const overdueBy = task.due_on ? -daysFromToday(task.due_on, today) : 0;
  const project = showProject ? projectName(projects, task.product_id) : undefined;

  return (
    <li className="group flex items-start gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface2">
      <button
        type="button"
        role="checkbox"
        aria-checked={task.status === "done"}
        aria-label={`Mark "${task.title}" done`}
        disabled={loading}
        onClick={() => run(() => setOpsTaskStatus(task.id, task.status === "done" ? "open" : "done"))}
        className={cn(
          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
          task.status === "done" ? "border-success bg-success text-white" : "border-border hover:border-accent",
        )}
      >
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : task.status === "done" ? <Check className="h-3 w-3" /> : null}
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm leading-snug text-ink", task.status === "done" && "text-muted line-through")}>{task.title}</p>
        {task.notes && <p className="mt-0.5 truncate text-xs text-muted">{task.notes}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {overdueBy > 0 && <Badge tone="danger">{overdueBy}d late</Badge>}
        {task.priority === "high" && <Badge tone={priorityTone.high}>High</Badge>}
        {project && <span className="text-xs text-muted">{project}</span>}
        <button
          type="button"
          aria-label={`Delete "${task.title}"`}
          disabled={loading}
          onClick={() => run(() => deleteOpsTask(task.id))}
          className="rounded p-1 text-muted opacity-0 transition-opacity hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
}

// --------------------------------------------------------------------------
// Event row
// --------------------------------------------------------------------------
export function OpsEventRow({ event, projects }: { event: OpsEvent; projects: OpsProject[] }) {
  const { run, loading } = useAction();
  const project = projectName(projects, event.product_id);

  return (
    <li className="group flex items-start gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface2">
      <span className="mt-0.5 w-11 shrink-0 text-xs font-semibold tabular-nums text-ink-strong">
        {event.all_day ? "All day" : timeLabel(event.starts_at)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug text-ink">{event.title}</p>
        {(event.location || event.notes) && <p className="mt-0.5 truncate text-xs text-muted">{[event.location, event.notes].filter(Boolean).join(" · ")}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Badge tone={kindTone[event.kind]}>{kindLabel[event.kind]}</Badge>
        {project && <span className="text-xs text-muted">{project}</span>}
        <button
          type="button"
          aria-label={`Delete "${event.title}"`}
          disabled={loading}
          onClick={() => run(() => deleteOpsEvent(event.id))}
          className="rounded p-1 text-muted opacity-0 transition-opacity hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
}

// --------------------------------------------------------------------------
// Quick add — one line, because a task you must open a dialog for goes unwritten
// --------------------------------------------------------------------------
export function OpsQuickAdd({ projects, defaultDue }: { projects: OpsProject[]; defaultDue?: string }) {
  const { run, loading } = useAction();
  const [title, setTitle] = useState("");
  const [dueOn, setDueOn] = useState(defaultDue ?? "");
  const [productId, setProductId] = useState(NO_PROJECT);
  const [priority, setPriority] = useState("normal");
  const titleRef = useRef<HTMLInputElement>(null);

  async function submit() {
    if (!title.trim()) return;
    const added = await run(() => createOpsTask({ title, dueOn, productId, priority, notes: "" }), () => setTitle(""));
    if (added) titleRef.current?.focus();
  }

  return (
    <form
      onSubmit={(bubbled) => { bubbled.preventDefault(); void submit(); }}
      className="flex items-center gap-2 rounded-lg border border-dashed bg-surface/50 p-2"
    >
      <Plus className="ml-1 h-4 w-4 shrink-0 text-muted" />
      <Input
        ref={titleRef}
        value={title}
        onChange={(changed) => setTitle(changed.target.value)}
        placeholder="Add a task…"
        className="h-8 flex-1 border-0 bg-transparent px-0 focus-visible:ring-0"
      />
      <Input type="date" value={dueOn} onChange={(changed) => setDueOn(changed.target.value)} className="h-8 w-36 text-xs" aria-label="Due date" />
      <Select value={priority} onChange={(changed) => setPriority(changed.target.value)} className="h-8 w-24 text-xs" aria-label="Priority">
        <option value="normal">Normal</option>
        <option value="high">High</option>
        <option value="low">Low</option>
      </Select>
      <Select value={productId} onChange={(changed) => setProductId(changed.target.value)} className="h-8 w-40 text-xs" aria-label="Project">
        <option value={NO_PROJECT}>No project</option>
        {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
      </Select>
      <Button type="submit" size="sm" disabled={loading || !title.trim()}>
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Add
      </Button>
    </form>
  );
}

// --------------------------------------------------------------------------
// Event form — collapsed by default; obligations are rarer than tasks
// --------------------------------------------------------------------------
export function OpsAddEvent({ projects, defaultDate }: { projects: OpsProject[]; defaultDate: string }) {
  const { run, loading } = useAction();
  const [open, setOpen] = useState(false);
  const emptyForm = { title: "", kind: "meeting", startsAt: `${defaultDate}T09:00`, endsAt: "", allDay: false, location: "", recurrence: "", notes: "", productId: NO_PROJECT };
  const [form, setForm] = useState(emptyForm);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  async function submit() {
    if (!form.title.trim()) return;
    await run(() => createOpsEvent(form), () => {
      setForm(emptyForm);
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <CalendarPlus className="h-3.5 w-3.5" />Add obligation
      </Button>
    );
  }

  return (
    <form
      onSubmit={(bubbled) => { bubbled.preventDefault(); void submit(); }}
      className="space-y-2.5 rounded-lg border bg-surface2/40 p-3"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-ink-strong">New obligation</p>
        <button type="button" onClick={() => setOpen(false)} aria-label="Cancel" className="text-muted hover:text-ink">
          <X className="h-4 w-4" />
        </button>
      </div>
      <Input value={form.title} onChange={(changed) => update("title", changed.target.value)} placeholder="What is it?" autoFocus />
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="ops-event-kind">Kind</Label>
          <Select id="ops-event-kind" value={form.kind} onChange={(changed) => update("kind", changed.target.value)}>
            <option value="meeting">Meeting</option>
            <option value="deadline">Deadline</option>
            <option value="tax">Tax</option>
            <option value="admin">Admin</option>
            <option value="focus">Focus block</option>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="ops-event-project">Project</Label>
          <Select id="ops-event-project" value={form.productId} onChange={(changed) => update("productId", changed.target.value)}>
            <option value={NO_PROJECT}>No project (company)</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="ops-event-start">Starts</Label>
          <Input id="ops-event-start" type="datetime-local" value={form.startsAt} onChange={(changed) => update("startsAt", changed.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ops-event-end">Ends (optional)</Label>
          <Input id="ops-event-end" type="datetime-local" value={form.endsAt} onChange={(changed) => update("endsAt", changed.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ops-event-location">Where (optional)</Label>
          <Input id="ops-event-location" value={form.location} onChange={(changed) => update("location", changed.target.value)} placeholder="Zoom, café, phone…" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ops-event-recurrence">Repeats (optional)</Label>
          <Input id="ops-event-recurrence" value={form.recurrence} onChange={(changed) => update("recurrence", changed.target.value)} placeholder="every quarter" />
        </div>
      </div>
      <Textarea value={form.notes} onChange={(changed) => update("notes", changed.target.value)} placeholder="Notes (optional)" rows={2} />
      <label className="flex items-center gap-2 text-xs text-muted">
        <input type="checkbox" checked={form.allDay} onChange={(changed) => update("allDay", changed.target.checked)} className="h-3.5 w-3.5 rounded border-border" />
        All day
      </label>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
        <Button type="submit" size="sm" disabled={loading || !form.title.trim()}>
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Add obligation
        </Button>
      </div>
    </form>
  );
}
