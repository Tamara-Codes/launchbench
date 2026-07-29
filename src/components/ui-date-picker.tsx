"use client";

import * as React from "react";
import { CalendarIcon, X } from "lucide-react";
import { Calendar } from "./ui-calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./ui-popover";
import { Input } from "./ui";
import { cn } from "@/lib/utils";
import { dayLabel } from "@/lib/ops-dates";

/**
 * Date and date-time pickers over the shared Calendar.
 *
 * They speak the same string formats the native inputs did — "YYYY-MM-DD" and
 * "YYYY-MM-DDTHH:mm" — so the server actions and their validation are unchanged.
 *
 * The key/Date conversions below use the browser's *local* calendar fields
 * rather than UTC on purpose: clicking the 29th must mean the 29th, and
 * toISOString() would shift it a day either side of midnight. The server then
 * resolves those wall-clock strings against OPS_TIMEZONE, which is the same zone
 * this machine runs in.
 */

function keyFromDate(date: Date): string {
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dateFromKey(key: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return undefined;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

const triggerClasses = cn(
  "inline-flex items-center gap-2 rounded-lg border bg-surface px-3 text-left text-sm text-ink transition-colors",
  "hover:bg-surface2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
);

/** Date only. `value` and `onChange` use "YYYY-MM-DD"; "" means unset. */
export function DatePicker({
  value,
  onChange,
  placeholder = "No date",
  clearable = true,
  className,
  id,
  ariaLabel,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  clearable?: boolean;
  className?: string;
  id?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const selected = dateFromKey(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" id={id} aria-label={ariaLabel ?? placeholder} className={cn(triggerClasses, "h-9", className)}>
          <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-muted" />
          <span className={cn("flex-1 truncate", !selected && "text-muted")}>{selected ? dayLabel(value) : placeholder}</span>
          {clearable && selected && (
            <span
              role="button"
              tabIndex={-1}
              aria-label="Clear date"
              // A nested <button> is invalid inside the trigger button, so this
              // is a span that stops the click from opening the popover.
              onClick={(clicked) => { clicked.stopPropagation(); onChange(""); }}
              className="rounded p-0.5 text-muted hover:text-danger"
            >
              <X className="h-3 w-3" />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto">
        <Calendar
          mode="single"
          autoFocus
          selected={selected}
          defaultMonth={selected}
          onSelect={(next) => { if (next) { onChange(keyFromDate(next)); setOpen(false); } }}
        />
      </PopoverContent>
    </Popover>
  );
}

/**
 * Date plus time. `value` and `onChange` use "YYYY-MM-DDTHH:mm".
 *
 * The time stays a plain time input: a clock widget is slower than typing
 * "14:30", and this form is used for meetings where the time is already known.
 */
export function DateTimePicker({
  value,
  onChange,
  id,
  required,
  placeholder = "Pick a date",
}: {
  value: string;
  onChange: (next: string) => void;
  id?: string;
  required?: boolean;
  placeholder?: string;
}) {
  const [datePart = "", timePart = ""] = value.split("T");

  function setDate(nextKey: string) {
    if (!nextKey) { onChange(""); return; }
    onChange(`${nextKey}T${timePart || "09:00"}`);
  }

  function setTime(nextTime: string) {
    // Without a date the time alone is meaningless, so default to today.
    onChange(`${datePart || keyFromDate(new Date())}T${nextTime}`);
  }

  return (
    <div className="flex gap-2">
      <DatePicker
        value={datePart}
        onChange={setDate}
        id={id}
        placeholder={placeholder}
        clearable={!required}
        className="min-w-0 flex-1"
      />
      <Input
        type="time"
        value={timePart}
        onChange={(changed) => setTime(changed.target.value)}
        aria-label="Time"
        className="w-24 shrink-0"
        required={required}
      />
    </div>
  );
}
