"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "./ui";
import { Select } from "./ui-select";
import { toast } from "./toast";
import { updateOpsTask } from "@/server/ops-actions";
import type { OpsProject, OpsTask } from "@/server/ops-cockpit";

/** Inline edit form shared by the Today list and a project's Tasks board.
 * `minimal` drops due date/priority/notes for the Today list, which only
 * wants to rename a ticket or move it to another project — those fields
 * still exist on the task and are preserved untouched on save, just not
 * editable from here; the full set stays editable from the project board. */
export function TaskEditForm({ task, projects, onClose, minimal = false }: { task: OpsTask; projects: OpsProject[]; onClose: () => void; minimal?: boolean }) {
  const [title, setTitle] = useState(task.title);
  const [dueOn, setDueOn] = useState(task.due_on ?? "");
  const [priority, setPriority] = useState(task.priority);
  const [projectId, setProjectId] = useState(task.project_id ?? "none");
  const [notes, setNotes] = useState(task.notes);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function save() {
    const trimmed = title.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const result = await updateOpsTask(task.id, { title: trimmed, projectId, dueOn, priority, notes });
      if (!result.ok) { toast(result.error, "error"); return; }
      router.refresh();
      onClose();
    });
  }

  return (
    <div className="space-y-2 rounded-lg border border-accent bg-surface p-2.5" onKeyDown={(event) => { if (event.key === "Escape") onClose(); }}>
      <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title" className="h-8 text-sm" autoFocus />
      <div className="flex flex-wrap items-center gap-1.5">
        {!minimal && (
          <input
            type="date"
            value={dueOn}
            onChange={(event) => setDueOn(event.target.value)}
            className="rounded-md border border-border bg-surface px-1.5 py-1 text-xs text-ink"
          />
        )}
        {!minimal && (
          <Select value={priority} onChange={(event) => setPriority(event.target.value as typeof priority)} className="h-7 w-auto gap-1.5 rounded-md border-border px-1.5 py-1 text-xs font-normal text-muted shadow-none">
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
          </Select>
        )}
        <Select value={projectId ?? "none"} onChange={(event) => setProjectId(event.target.value)} className="h-7 w-auto gap-1.5 rounded-md border-border px-1.5 py-1 text-xs font-normal text-muted shadow-none">
          <option value="none">Company</option>
          {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
        </Select>
      </div>
      {!minimal && (
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Notes"
          rows={2}
          className="w-full rounded-md border border-border bg-surface px-2 py-1 text-xs text-ink"
        />
      )}
      <div className="flex justify-end gap-1.5">
        <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={pending}>Cancel</Button>
        <Button type="button" size="sm" onClick={save} disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
      </div>
    </div>
  );
}
