"use client";

import * as React from "react";
import { DayPicker } from "react-day-picker";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A month grid styled with the app's own tokens rather than react-day-picker's
 * stylesheet, so it matches the rest of the UI in both themes.
 *
 * Monday-first, because this is a European calendar and a Sunday-first grid
 * reads as one day out at a glance.
 */
export function Calendar({ className, classNames, ...props }: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      weekStartsOn={1}
      showOutsideDays
      className={cn("w-fit select-none", className)}
      classNames={{
        months: "relative",
        month: "space-y-2",
        month_caption: "flex h-8 items-center justify-center",
        caption_label: "text-sm font-semibold text-ink-strong",
        nav: "absolute inset-x-0 top-0 flex h-8 items-center justify-between",
        button_previous: "inline-flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface2 hover:text-ink disabled:opacity-40",
        button_next: "inline-flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface2 hover:text-ink disabled:opacity-40",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "w-9 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted",
        week: "flex w-full",
        day: "h-9 w-9 p-0 text-center",
        day_button: cn(
          "h-9 w-9 rounded-lg text-sm font-medium text-ink transition-colors",
          "hover:bg-surface2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
        ),
        selected: "[&>button]:bg-accent [&>button]:text-accent-fg [&>button]:hover:bg-accent",
        today: "[&>button]:font-bold [&>button]:text-accent",
        outside: "[&>button]:text-muted/50",
        disabled: "[&>button]:pointer-events-none [&>button]:opacity-40",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, ...rest }) =>
          orientation === "left" ? <ChevronLeft className="h-4 w-4" {...rest} /> : <ChevronRight className="h-4 w-4" {...rest} />,
      }}
      {...props}
    />
  );
}
