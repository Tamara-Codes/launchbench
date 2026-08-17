"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { OpsAddEvent } from "./ops-cockpit-panel";
import { cn } from "@/lib/utils";
import { dayNumber, monthKey, timeLabel } from "@/lib/ops-dates";
import type { OpsEvent, OpsProject, OpsTask, ScheduledPost } from "@/server/ops-cockpit";

/**
 * Obligations read as tinted chips with a coloured rail rather than a dot plus
 * a line of text: at this size the rail carries the type from across the room,
 * where a 6px dot needed the legend every time.
 */
const kindChip: Record<OpsEvent["kind"], string> = {
  meeting: "border-l-accent bg-accent-soft/55",
  deadline: "border-l-danger bg-danger-soft/55",
  tax: "border-l-warning bg-warning-soft/55",
  admin: "border-l-muted bg-surface2",
  focus: "border-l-info bg-info-soft/55",
};

/** Shared chip shape. Only the rail colour and the tint vary by row type. */
const chipBase = "flex items-center gap-1.5 overflow-hidden rounded-md border-l-2 px-1.5 py-[3px] text-[11px] leading-4 transition-colors";

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
  // Which day's add-event dialog is open. One at a time, keyed so switching days
  // remounts the form with the new default date rather than keeping the old one.
  const [addingOn, setAddingOn] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <>
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

      <div className="overflow-hidden rounded-xl border bg-surface shadow-sm">
        <div className="grid grid-cols-7 border-b bg-surface2/50">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((weekday, index) => (
            <div
              key={weekday}
              className={cn(
                "px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.12em]",
                index >= 5 ? "text-muted/60" : "text-muted",
              )}
            >
              {weekday}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((key, index) => {
            const cell = content[key] ?? { events: [], tasks: [], posts: [] };
            const items = [
              ...cell.events.map((event) => ({ kind: "event" as const, id: event.id, event })),
              ...cell.tasks.map((task) => ({ kind: "task" as const, id: task.id, task })),
              ...cell.posts.map((post) => ({ kind: "post" as const, id: post.id, post })),
            ];
            const isToday = key === today;
            const outside = monthKey(key) !== month;
            const weekend = index % 7 >= 5;
            const showAll = expanded === key;
            const visible = showAll ? items : items.slice(0, MAX_VISIBLE);
            const hidden = items.length - visible.length;

            return (
              <div
                key={key}
                className={cn(
                  "group relative min-h-28 border-b border-r border-border/70 p-1.5 transition-colors",
                  "[&:nth-child(7n)]:border-r-0",
                  outside ? "bg-canvas/40" : weekend && "bg-surface2/20",
                  isToday && "bg-accent-soft/20 ring-1 ring-inset ring-accent/40",
                )}
              >
                <div className="mb-1.5 flex items-center justify-between gap-1">
                  <span
                    className={cn(
                      "flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold tabular-nums",
                      outside ? "text-muted/40" : weekend ? "text-muted" : "text-ink",
                      isToday && "bg-accent text-accent-fg",
                    )}
                  >
                    {dayNumber(key)}
                  </span>
                  <button
                    type="button"
                    aria-label={`Add an obligation on ${key}`}
                    onClick={() => setAddingOn(key)}
                    className={cn(
                      "rounded-md p-1 text-muted opacity-0 transition-all hover:bg-surface2 hover:text-accent",
                      "focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 group-hover:opacity-100",
                    )}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className={cn("space-y-1", outside && "opacity-60")}>
                  {visible.map((item) => {
                    if (item.kind === "event") {
                      return (
                        <div
                          key={item.id}
                          className={cn(chipBase, kindChip[item.event.kind], "text-ink-strong hover:brightness-125")}
                          title={item.event.title}
                        >
                          {!item.event.all_day && (
                            <span className="shrink-0 text-[10px] font-semibold tabular-nums text-muted">{timeLabel(item.event.starts_at)}</span>
                          )}
                          <span className="truncate font-medium">{item.event.title}</span>
                        </div>
                      );
                    }
                    if (item.kind === "task") {
                      const done = item.task.status === "done";
                      return (
                        <div
                          key={item.id}
                          className={cn(
                            chipBase,
                            "border-l-border bg-surface2/70 hover:bg-surface2",
                            done ? "text-muted line-through" : "text-ink",
                          )}
                          title={item.task.title}
                        >
                          <span
                            className={cn(
                              "h-2.5 w-2.5 shrink-0 rounded-[3px] border",
                              done ? "border-success bg-success" : "border-muted/70",
                            )}
                          />
                          <span className="truncate">{item.task.title}</span>
                        </div>
                      );
                    }
                    return (
                      <div
                        key={item.id}
                        className={cn(chipBase, "border-l-muted/50 bg-surface2/40 text-muted hover:bg-surface2/70")}
                        title={item.post.hook || item.post.content_type}
                      >
                        <span className="shrink-0 rounded bg-surface px-1 py-px text-[9px] font-bold uppercase tracking-wider text-ink">
                          {item.post.platform === "x" ? "X" : item.post.platform.slice(0, 2)}
                        </span>
                        <span className="truncate">{item.post.hook || item.post.content_type}</span>
                      </div>
                    );
                  })}
                  {hidden > 0 && (
                    <button
                      type="button"
                      onClick={() => setExpanded(key)}
                      className="w-full rounded-md px-1.5 py-px text-left text-[10px] font-semibold uppercase tracking-wide text-muted transition-colors hover:bg-surface2 hover:text-accent"
                    >
                      +{hidden} more
                    </button>
                  )}
                  {showAll && items.length > MAX_VISIBLE && (
                    <button
                      type="button"
                      onClick={() => setExpanded(null)}
                      className="w-full rounded-md px-1.5 py-px text-left text-[10px] font-semibold uppercase tracking-wide text-muted transition-colors hover:bg-surface2 hover:text-ink"
                    >
                      Less
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
