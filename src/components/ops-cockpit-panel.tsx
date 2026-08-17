"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Loader2 } from "lucide-react";
import { Button, Input, Label, Textarea } from "./ui";
import { Select } from "./ui-select";
import { DateTimePicker } from "./ui-date-picker";
import { Dialog, DialogContent, DialogTrigger } from "./ui-dialog";
import { toast } from "./toast";
import { createOpsEvent } from "@/server/ops-actions";
import { dayLabel } from "@/lib/ops-dates";
import type { OpsProject } from "@/server/ops-cockpit";

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

// --------------------------------------------------------------------------
// Event form — a modal, because obligations carry six fields and the calendar
// opens it for a specific day: a form that pushed the grid down moved the day
// she had just clicked out from under the pointer.
// --------------------------------------------------------------------------
export function OpsAddEvent({
  projects,
  defaultDate,
  open: openProp,
  onOpenChange,
  hideTrigger = false,
}: {
  projects: OpsProject[];
  defaultDate: string;
  /** Controlled mode, so the calendar can open this form for a clicked day. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}) {
  const { run, loading } = useAction();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = (next: boolean) => {
    if (openProp === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };
  const emptyForm = { title: "", kind: "meeting", startsAt: `${defaultDate}T09:00`, endsAt: "", allDay: false, location: "", recurrence: "", notes: "", projectId: NO_PROJECT };
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <CalendarPlus className="h-3.5 w-3.5" />Add obligation
          </Button>
        </DialogTrigger>
      )}
      <DialogContent title="New obligation" description={dayLabel(defaultDate)}>
        <form onSubmit={(bubbled) => { bubbled.preventDefault(); void submit(); }} className="space-y-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="ops-event-title">What is it?</Label>
            <Input
              id="ops-event-title"
              value={form.title}
              onChange={(changed) => update("title", changed.target.value)}
              placeholder="Call with the accountant"
              autoFocus
            />
          </div>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ops-event-kind">Kind</Label>
              <Select id="ops-event-kind" value={form.kind} onChange={(changed) => update("kind", changed.target.value)}>
                <option value="meeting">Meeting</option>
                <option value="deadline">Deadline</option>
                <option value="tax">Tax</option>
                <option value="admin">Admin</option>
                <option value="focus">Focus block</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ops-event-project">Project</Label>
              <Select id="ops-event-project" value={form.projectId} onChange={(changed) => update("projectId", changed.target.value)}>
                <option value={NO_PROJECT}>No project (company)</option>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ops-event-start">Starts</Label>
              <DateTimePicker id="ops-event-start" value={form.startsAt} onChange={(next) => update("startsAt", next)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ops-event-end">Ends (optional)</Label>
              <DateTimePicker id="ops-event-end" value={form.endsAt} onChange={(next) => update("endsAt", next)} placeholder="No end" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ops-event-location">Where (optional)</Label>
              <Input id="ops-event-location" value={form.location} onChange={(changed) => update("location", changed.target.value)} placeholder="Zoom, café, phone…" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ops-event-recurrence">Repeats (optional)</Label>
              <Input id="ops-event-recurrence" value={form.recurrence} onChange={(changed) => update("recurrence", changed.target.value)} placeholder="every quarter" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ops-event-notes">Notes (optional)</Label>
            <Textarea id="ops-event-notes" value={form.notes} onChange={(changed) => update("notes", changed.target.value)} rows={2} />
          </div>
          <label className="flex w-fit items-center gap-2 text-xs text-muted">
            <input type="checkbox" checked={form.allDay} onChange={(changed) => update("allDay", changed.target.checked)} className="h-3.5 w-3.5 rounded border-border" />
            All day
          </label>
          <div className="flex justify-end gap-2 border-t pt-3.5">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" size="sm" disabled={loading || !form.title.trim()}>
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Add obligation
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
