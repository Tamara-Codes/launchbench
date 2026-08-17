"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Loader2, Plus, Trash2 } from "lucide-react";
import { Badge, Input } from "./ui";
import { toast } from "./toast";
import { TaskEditForm } from "./ops-task-edit-form";
import { cn } from "@/lib/utils";
import { createOpsTask, deleteOpsTask, reorderOpsTasks } from "@/server/ops-actions";
import { daysFromToday } from "@/lib/ops-dates";
import type { OpsProject, OpsTask, OpsTaskStatus, TodoBoardGroup } from "@/server/ops-cockpit";

const COLUMNS: { key: "backlog" | "inProgress" | "done"; status: OpsTaskStatus; label: string }[] = [
  { key: "backlog", status: "backlog", label: "Backlog" },
  { key: "inProgress", status: "in_progress", label: "In Progress" },
  { key: "done", status: "done", label: "Done" },
];

const priorityTone = { high: "danger", normal: "neutral", low: "neutral" } as const;

function columnId(projectKey: string, status: OpsTaskStatus) {
  return `${projectKey}:${status}`;
}

/** Static card body, shared by the sortable card and the drag overlay preview
 * — the overlay must not itself call useSortable, or it registers a second
 * sortable node under the same id as the card mid-drag. */
function TaskCardBody({ task, today, dragHandleProps, onDelete, onEdit, busy }: {
  task: OpsTask;
  today: string;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
  onDelete?: () => void;
  onEdit?: () => void;
  busy?: boolean;
}) {
  const overdueBy = task.due_on ? -daysFromToday(task.due_on, today) : 0;
  return (
    <div className="group flex items-start gap-2 rounded-lg border bg-surface p-2.5 shadow-sm">
      <button type="button" aria-label="Drag to reorder" className="mt-0.5 shrink-0 cursor-grab touch-none text-muted hover:text-ink active:cursor-grabbing" {...dragHandleProps}>
        <GripVertical className="h-4 w-4" />
      </button>
      <div
        className={cn("min-w-0 flex-1", onEdit && "cursor-pointer")}
        onClick={onEdit}
        role={onEdit ? "button" : undefined}
        tabIndex={onEdit ? 0 : undefined}
        onKeyDown={onEdit ? (event) => { if (event.key === "Enter") onEdit(); } : undefined}
      >
        <p className={cn("text-sm leading-snug text-ink", task.status === "done" && "text-muted line-through")}>{task.title}</p>
        {task.notes && <p className="mt-0.5 truncate text-xs text-muted">{task.notes}</p>}
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {overdueBy > 0 && task.status !== "done" && <Badge tone="danger">{overdueBy}d late</Badge>}
          {task.priority === "high" && <Badge tone={priorityTone.high}>High</Badge>}
          {task.due_on && <span className="text-xs text-muted">{task.due_on}</span>}
        </div>
      </div>
      {onDelete && (
        <button
          type="button"
          aria-label={`Delete "${task.title}"`}
          disabled={busy}
          onClick={onDelete}
          className="shrink-0 rounded p-1 text-muted opacity-0 transition-opacity hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        </button>
      )}
    </div>
  );
}

function TaskCard({ task, today, projects }: { task: OpsTask; today: string; projects: OpsProject[] }) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

  async function remove() {
    setBusy(true);
    const result = await deleteOpsTask(task.id);
    if (!result.ok) { toast(result.error, "error"); setBusy(false); return; }
    router.refresh();
  }

  const style = { transform: CSS.Transform.toString(transform), transition };
  if (editing) {
    return (
      <li ref={setNodeRef} style={style}>
        <TaskEditForm task={task} projects={projects} onClose={() => setEditing(false)} />
      </li>
    );
  }

  return (
    <li ref={setNodeRef} style={style} className={cn(isDragging && "opacity-40")}>
      <TaskCardBody task={task} today={today} dragHandleProps={{ ...attributes, ...listeners }} onDelete={() => void remove()} onEdit={() => setEditing(true)} busy={busy} />
    </li>
  );
}

/** Fires `onAdd` the instant the title is entered — the caller inserts an
 * optimistic row immediately rather than waiting on the round trip, since
 * that wait was the main source of "adding a ticket feels slow" complaints. */
function AddTicket({ onAdd }: { onAdd: (title: string) => void }) {
  const [title, setTitle] = useState("");

  function submit() {
    const trimmed = title.trim();
    if (!trimmed) return;
    setTitle("");
    onAdd(trimmed);
  }

  return (
    <form onSubmit={(event) => { event.preventDefault(); submit(); }} className="flex items-center gap-1.5">
      <Plus className="h-3.5 w-3.5 shrink-0 text-muted" />
      <Input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Add a ticket…"
        className="h-8 border-0 bg-transparent px-1 text-xs focus-visible:ring-0"
      />
    </form>
  );
}

function Column({ id, label, tasks, today, projects, footer }: { id: string; label: string; tasks: OpsTask[]; today: string; projects: OpsProject[]; footer?: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div className="min-w-[220px] flex-1 space-y-2">
      <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">{label} <span className="text-muted/70">{tasks.length}</span></p>
      <div ref={setNodeRef} className={cn("min-h-[3rem] space-y-2 rounded-lg p-1 transition-colors", isOver && "bg-accent-soft/50")}>
        <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-2">
            {tasks.map((task) => <TaskCard key={task.id} task={task} today={today} projects={projects} />)}
          </ul>
        </SortableContext>
        {footer}
      </div>
    </div>
  );
}

/** The backlog/in-progress/done board for a single project (or the company
 * lane, when `group.project` is null). Used on that project's own Tasks tab —
 * the daily Today page shows a flat cross-project list instead, see
 * ops-todo-list.tsx. */
export function ProjectBoard({ group, today, projects }: { group: TodoBoardGroup; today: string; projects: OpsProject[] }) {
  const router = useRouter();
  const projectKey = group.project?.id ?? "company";
  const [columns, setColumns] = useState(() => ({ backlog: group.backlog, inProgress: group.inProgress, done: group.done }));
  const [activeTask, setActiveTask] = useState<OpsTask | null>(null);

  // `group` is a fresh object every server render (new ticket added, reorder
  // confirmed) — reconcile local optimistic state against it during render
  // rather than in an effect, so a refresh can't flash the pre-drag order.
  const [syncedGroup, setSyncedGroup] = useState(group);
  if (group !== syncedGroup) {
    setSyncedGroup(group);
    setColumns({ backlog: group.backlog, inProgress: group.inProgress, done: group.done });
  }
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function findColumnKey(taskId: string): keyof typeof columns | null {
    return (Object.keys(columns) as (keyof typeof columns)[]).find((key) => columns[key].some((task) => task.id === taskId)) ?? null;
  }

  function handleDragStart(event: DragStartEvent) {
    const key = findColumnKey(String(event.active.id));
    if (key) setActiveTask(columns[key].find((task) => task.id === event.active.id) ?? null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const fromKey = findColumnKey(String(active.id));
    if (!fromKey) return;
    const overId = String(over.id);
    const directColumn = COLUMNS.find((column) => columnId(projectKey, column.status) === overId);
    const toKey = directColumn?.key ?? findColumnKey(overId);
    if (!toKey) return;

    const activeId = String(active.id);
    const next = { ...columns, [fromKey]: [...columns[fromKey]], [toKey]: fromKey === toKey ? columns[fromKey] : [...columns[toKey]] };
    const movingIndex = next[fromKey].findIndex((task) => task.id === activeId);
    const [moving] = next[fromKey].splice(movingIndex, 1);
    if (!moving) return;
    const overIndex = directColumn ? next[toKey].length : next[toKey].findIndex((task) => task.id === overId);
    next[toKey].splice(overIndex < 0 ? next[toKey].length : overIndex, 0, moving);
    setColumns(next);

    const status = COLUMNS.find((column) => column.key === toKey)!.status;
    const updates = [
      ...next[fromKey].map((task, index) => ({ id: task.id, status: fromKey === "backlog" ? "backlog" as const : fromKey === "inProgress" ? "in_progress" as const : "done" as const, sortOrder: index })),
      ...(fromKey === toKey ? [] : next[toKey].map((task, index) => ({ id: task.id, status, sortOrder: index }))),
    ];
    const result = await reorderOpsTasks(updates);
    if (!result.ok) { toast(result.error, "error"); router.refresh(); return; }
    router.refresh();
  }

  // Optimistic: the ticket appears in Backlog the instant it's typed, rather
  // than after a full round trip + page refetch. `columns` gets overwritten
  // with the real row (real id, real sort_order) as soon as the server render
  // that follows `router.refresh()` lands, via the sync-on-render above.
  async function addTicket(title: string) {
    const placeholder: OpsTask = {
      id: `pending-${crypto.randomUUID()}`,
      title,
      status: "backlog",
      priority: "normal",
      due_on: null,
      notes: "",
      project_id: group.project?.id ?? null,
      sort_order: columns.backlog.length,
    };
    setColumns((prev) => ({ ...prev, backlog: [...prev.backlog, placeholder] }));
    const result = await createOpsTask({ title, projectId: group.project?.id ?? "none", dueOn: "", priority: "normal", notes: "" });
    if (!result.ok) { toast(result.error, "error"); }
    router.refresh();
  }

  return (
    <DndContext id={`ops-todo-${projectKey}`} sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex flex-col gap-4 sm:flex-row">
        {COLUMNS.map((column) => (
          <Column
            key={column.key}
            id={columnId(projectKey, column.status)}
            label={column.label}
            tasks={columns[column.key]}
            today={today}
            projects={projects}
            footer={column.key === "backlog" ? <AddTicket onAdd={(title) => void addTicket(title)} /> : undefined}
          />
        ))}
      </div>
      <DragOverlay>{activeTask && <TaskCardBody task={activeTask} today={today} />}</DragOverlay>
    </DndContext>
  );
}
