"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { OpsAddEvent } from "./ops-cockpit-panel";
import { cn } from "@/lib/utils";
import { dayNumber, monthKey, timeLabel } from "@/lib/ops-dates";
import type { OpsEvent, OpsProject, OpsTask, ScheduledPost } from "@/server/ops-cockpit";

/** Colour by obligation type, matching the badges used on the Today page. */
const kindDot: Record<OpsEvent["kind"], string> = {
  meeting: "bg-accent",
  deadline: "bg-danger",
  tax: "bg-warning",
  admin: "bg-muted",
  focus: "bg-info",
};

/** How many items fit in a cell before it collapses into a count. */
const MAX_VISIBLE = 3;

type DayContent = { events: OpsEvent[]; tasks: OpsTask[]; posts: ScheduledPost[] };

export function OpsMonthGrid({
  month,
  days,
  today,
  content,
  projects,
}: {
  month: string;
  days: string[];
  today: string;
  content: Record<string, DayContent>;
  projects: OpsProject[];
}) {
  // Which day's add-event form is open. One at a time, keyed so switching days
  // remounts the form with the new default date rather than keeping the old one.
  const [addingOn, setAddingOn] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {addingOn && (
        <OpsAddEvent
          key={addingOn}
          projects={projects}
          defaultDate={addingOn}
          open
          hideTrigger
          onOpenChange={(open) => { if (!open) setAddingOn(null); }}
        />
      )}

      <div className="overflow-hidden rounded-xl border bg-surface">
        <div className="grid grid-cols-7 border-b bg-surface2/40">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((weekday) => (
            <div key={weekday} className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">{weekday}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((key) => {
            const cell = content[key] ?? { events: [], tasks: [], posts: [] };
            const items = [
              ...cell.events.map((event) => ({ kind: "event" as const, id: event.id, event })),
              ...cell.tasks.map((task) => ({ kind: "task" as const, id: task.id, task })),
              ...cell.posts.map((post) => ({ kind: "post" as const, id: post.id, post })),
            ];
            const isToday = key === today;
            const outside = monthKey(key) !== month;
            const showAll = expanded === key;
            const visible = showAll ? items : items.slice(0, MAX_VISIBLE);
            const hidden = items.length - visible.length;

            return (
              <div
                key={key}
                className={cn(
                  "group relative min-h-24 border-b border-r p-1.5 last:border-r-0 [&:nth-child(7n)]:border-r-0",
                  outside && "bg-surface2/30",
                  isToday && "bg-accent-soft/25",
                )}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={cn(
                      "text-xs font-semibold tabular-nums",
                      outside ? "text-muted/50" : "text-ink",
                      isToday && "flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accent-fg",
                    )}
                  >
                    {dayNumber(key)}
                  </span>
                  <button
                    type="button"
                    aria-label={`Add an obligation on ${key}`}
                    onClick={() => setAddingOn(key)}
                    className="rounded p-0.5 text-muted opacity-0 transition-opacity hover:bg-surface2 hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="space-y-0.5">
                  {visible.map((item) => {
                    if (item.kind === "event") {
                      return (
                        <div key={item.id} className="flex items-center gap-1 truncate text-[11px] leading-tight text-ink" title={item.event.title}>
                          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", kindDot[item.event.kind])} />
                          {!item.event.all_day && <span className="shrink-0 tabular-nums text-muted">{timeLabel(item.event.starts_at)}</span>}
                          <span className="truncate">{item.event.title}</span>
                        </div>
                      );
                    }
                    if (item.kind === "task") {
                      return (
                        <div
                          key={item.id}
                          className={cn("flex items-center gap-1 truncate text-[11px] leading-tight", item.task.status === "done" ? "text-muted line-through" : "text-ink")}
                          title={item.task.title}
                        >
                          <span className="h-1.5 w-1.5 shrink-0 rounded-sm border border-muted" />
                          <span className="truncate">{item.task.title}</span>
                        </div>
                      );
                    }
                    return (
                      <div key={item.id} className="flex items-center gap-1 truncate text-[11px] leading-tight text-muted" title={item.post.hook || item.post.content_type}>
                        <span className="shrink-0 font-semibold uppercase">{item.post.platform === "x" ? "X" : item.post.platform.slice(0, 2)}</span>
                        <span className="truncate">{item.post.hook || item.post.content_type}</span>
                      </div>
                    );
                  })}
                  {hidden > 0 && (
                    <button type="button" onClick={() => setExpanded(key)} className="text-[11px] text-accent hover:underline">
                      +{hidden} more
                    </button>
                  )}
                  {showAll && items.length > MAX_VISIBLE && (
                    <button type="button" onClick={() => setExpanded(null)} className="text-[11px] text-muted hover:underline">
                      Show less
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
