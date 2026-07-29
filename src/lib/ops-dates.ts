/**
 * Calendar maths for the ops cockpit, anchored to one fixed zone.
 *
 * This matters because the cockpit's whole job is answering "what is on TODAY",
 * and "today" is a local calendar question while Vercel's runtime clock is UTC.
 * Deriving the day from the server's own zone would roll the cockpit over to
 * tomorrow at 02:00 Zagreb time, so for two hours every night the agenda would
 * show the wrong day and tasks due today would render as overdue.
 *
 * Single operator, one country: a constant is the honest answer here. If the
 * workspace ever needs its own zone, this is the only place that changes.
 */
export const OPS_TIMEZONE = "Europe/Zagreb";

/** The local calendar day as "YYYY-MM-DD" — the same shape as ops_tasks.due_on. */
export function dayKey(instant: Date = new Date()): string {
  // en-CA formats as ISO-like YYYY-MM-DD, which avoids assembling parts by hand.
  return new Intl.DateTimeFormat("en-CA", { timeZone: OPS_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);
}

/** How far the zone is ahead of UTC at a given instant, in milliseconds. */
export function zoneOffsetMs(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: OPS_TIMEZONE,
    hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(instant);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  // Interpreting the local wall clock as if it were UTC, then differencing
  // against the real instant, yields the offset without a date library.
  const asIfUtc = Date.UTC(read("year"), read("month") - 1, read("day"), read("hour") % 24, read("minute"), read("second"));
  return asIfUtc - instant.getTime();
}

/** The instant at which a local calendar day begins. */
export function startOfDay(key: string): Date {
  const wallClock = Date.parse(`${key}T00:00:00Z`);
  // Midnight is never inside a DST transition in this zone (clocks move at
  // 02:00/03:00), so one offset lookup is enough.
  return new Date(wallClock - zoneOffsetMs(new Date(wallClock)));
}

/** Shifts a "YYYY-MM-DD" key by whole days, staying on calendar boundaries. */
export function addDays(key: string, days: number): string {
  return dayKey(new Date(startOfDay(key).getTime() + days * 86_400_000 + 43_200_000));
}

/** Local clock time for an event row, e.g. "14:30". */
export function timeLabel(instant: string | Date): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: OPS_TIMEZONE, hour: "2-digit", minute: "2-digit" }).format(new Date(instant));
}

/** "Wed 29 Jul" — compact enough for day headings in a dense list. */
export function dayLabel(key: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: OPS_TIMEZONE, weekday: "short", day: "numeric", month: "short" }).format(startOfDay(key));
}

/** Relative day naming, so the agenda reads like speech rather than dates. */
export function relativeDayLabel(key: string, today: string = dayKey()): string {
  if (key === today) return "Today";
  if (key === addDays(today, 1)) return "Tomorrow";
  return dayLabel(key);
}

/** Whole days from today, negative in the past. Used for overdue emphasis. */
export function daysFromToday(key: string, today: string = dayKey()): number {
  return Math.round((startOfDay(key).getTime() - startOfDay(today).getTime()) / 86_400_000);
}

/**
 * Turns a datetime-local value ("2026-07-29T14:30") into a real instant.
 *
 * Without this the string reaches timestamptz with no zone attached and Postgres
 * reads it as UTC, so a 14:30 meeting would be stored as 16:30 Zagreb. The one
 * ambiguous hour of the year is the autumn DST repeat, which resolves to the
 * first pass — acceptable for a personal calendar.
 */
export function fromDateTimeLocalValue(value: string): string {
  // The shape check is not belt-and-braces: V8's date parser is lenient enough
  // to read "not a date:00Z" as 2000-01-01, so a NaN guard alone would let
  // garbage through as a silently wrong event in the year 2000.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error(`Could not read the date "${value}".`);
  const wallClock = Date.parse(`${value}:00Z`);
  if (Number.isNaN(wallClock)) throw new Error(`"${value}" is not a real date.`);
  // The shape check still lets 2026-02-30 through, and V8 rolls it silently
  // forward to 2 March rather than failing. Comparing the parsed fields back
  // against the input is the only way to catch it — which matters most when the
  // chat agent, not a date picker, is the one supplying the value.
  const parsed = new Date(wallClock);
  const pad = (part: number) => String(part).padStart(2, "0");
  const normalized = `${parsed.getUTCFullYear()}-${pad(parsed.getUTCMonth() + 1)}-${pad(parsed.getUTCDate())}T${pad(parsed.getUTCHours())}:${pad(parsed.getUTCMinutes())}`;
  if (normalized !== value) throw new Error(`"${value}" is not a real date.`);
  return new Date(wallClock - zoneOffsetMs(parsed)).toISOString();
}

/** The value a datetime-local input expects, in this zone rather than UTC. */
export function toDateTimeLocalValue(instant: string | Date): string {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: OPS_TIMEZONE,
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date(instant));
  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${read("year")}-${read("month")}-${read("day")}T${read("hour")}:${read("minute")}`;
}
