import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  dayKey,
  dayNumber,
  daysFromToday,
  fromDateTimeLocalValue,
  monthBounds,
  monthGridDays,
  monthKey,
  monthLabel,
  relativeDayLabel,
  startOfDay,
  timeLabel,
  toDateTimeLocalValue,
} from "./ops-dates";

/**
 * These tests exist because the cockpit's whole premise is "what is on today",
 * and the deployment target (Vercel) runs in UTC while the operator lives in
 * Zagreb. Every case below fails if the code ever falls back to the system zone.
 */

describe("day boundaries in the operating zone", () => {
  it("treats 23:30 UTC in summer as the next Zagreb day", () => {
    // 22:30 UTC is 00:30 Zagreb (CEST, UTC+2) — already tomorrow locally.
    expect(dayKey(new Date("2026-07-29T22:30:00Z"))).toBe("2026-07-30");
  });

  it("treats 23:30 UTC in winter as the next Zagreb day", () => {
    // CET is UTC+1, so the rollover happens an hour later than in summer.
    expect(dayKey(new Date("2026-01-15T22:30:00Z"))).toBe("2026-01-15");
    expect(dayKey(new Date("2026-01-15T23:30:00Z"))).toBe("2026-01-16");
  });

  it("starts a summer day at 22:00 UTC the previous evening", () => {
    expect(startOfDay("2026-07-29").toISOString()).toBe("2026-07-28T22:00:00.000Z");
  });

  it("starts a winter day at 23:00 UTC the previous evening", () => {
    expect(startOfDay("2026-01-15").toISOString()).toBe("2026-01-14T23:00:00.000Z");
  });
});

describe("calendar arithmetic across DST", () => {
  it("steps forward a whole day through the spring transition", () => {
    // Clocks jump forward on 2026-03-29; the day count must not slip.
    expect(addDays("2026-03-28", 1)).toBe("2026-03-29");
    expect(addDays("2026-03-29", 1)).toBe("2026-03-30");
  });

  it("steps forward a whole day through the autumn transition", () => {
    // Clocks fall back on 2026-10-25, making that local day 25 hours long.
    expect(addDays("2026-10-24", 1)).toBe("2026-10-25");
    expect(addDays("2026-10-25", 1)).toBe("2026-10-26");
  });

  it("steps backwards and across month and year ends", () => {
    expect(addDays("2026-08-01", -1)).toBe("2026-07-31");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("counts whole days between keys regardless of DST", () => {
    expect(daysFromToday("2026-07-29", "2026-07-29")).toBe(0);
    expect(daysFromToday("2026-08-02", "2026-07-29")).toBe(4);
    // An overdue task: negative, which is what drives the "3d late" badge.
    expect(daysFromToday("2026-07-26", "2026-07-29")).toBe(-3);
    expect(daysFromToday("2026-10-26", "2026-10-24")).toBe(2);
  });
});

describe("datetime-local round trip", () => {
  it("reads a summer wall-clock time as Zagreb, not UTC", () => {
    // The bug this guards: 14:30 stored as 14:30Z would surface as 16:30 local.
    expect(fromDateTimeLocalValue("2026-07-29T14:30")).toBe("2026-07-29T12:30:00.000Z");
  });

  it("reads a winter wall-clock time as Zagreb, not UTC", () => {
    expect(fromDateTimeLocalValue("2026-01-15T14:30")).toBe("2026-01-15T13:30:00.000Z");
  });

  it("survives a round trip in both directions", () => {
    for (const value of ["2026-07-29T14:30", "2026-01-15T08:05", "2026-12-31T23:59"]) {
      expect(toDateTimeLocalValue(fromDateTimeLocalValue(value))).toBe(value);
    }
  });

  it("rejects malformed input instead of trusting the lenient parser", () => {
    // V8 reads "not a date:00Z" as 2000-01-01, so this must be caught on shape.
    expect(() => fromDateTimeLocalValue("not a date")).toThrow();
    expect(() => fromDateTimeLocalValue("")).toThrow();
    expect(() => fromDateTimeLocalValue("2026-07-29")).toThrow();
    expect(() => fromDateTimeLocalValue("2026-07-29T14:30:00Z")).toThrow();
  });

  it("rejects a well-shaped but impossible date", () => {
    expect(() => fromDateTimeLocalValue("2026-02-30T10:00")).toThrow();
    expect(() => fromDateTimeLocalValue("2026-13-01T10:00")).toThrow();
  });
});

describe("month grids", () => {
  it("shifts months and wraps the year in both directions", () => {
    expect(addMonths("2026-07", 1)).toBe("2026-08");
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-07", -7)).toBe("2025-12");
  });

  it("finds month bounds including February in a leap and non-leap year", () => {
    expect(monthBounds("2026-07")).toEqual({ first: "2026-07-01", last: "2026-07-31" });
    expect(monthBounds("2026-02")).toEqual({ first: "2026-02-01", last: "2026-02-28" });
    expect(monthBounds("2028-02")).toEqual({ first: "2028-02-01", last: "2028-02-29" });
    expect(monthBounds("2026-12")).toEqual({ first: "2026-12-01", last: "2026-12-31" });
  });

  it("builds a Monday-first grid of whole weeks", () => {
    const july = monthGridDays("2026-07");
    // 1 July 2026 is a Wednesday, so the grid opens on Monday 29 June.
    expect(july[0]).toBe("2026-06-29");
    expect(july.length % 7).toBe(0);
    expect(july).toContain("2026-07-01");
    expect(july).toContain("2026-07-31");
    // 31 July 2026 is a Friday, so the grid closes on Sunday 2 August.
    expect(july.at(-1)).toBe("2026-08-02");
  });

  it("builds a grid for a month that already starts on a Monday", () => {
    // 1 June 2026 is a Monday: no leading days from May.
    const june = monthGridDays("2026-06");
    expect(june[0]).toBe("2026-06-01");
    expect(june.length % 7).toBe(0);
  });

  it("spans DST transitions without dropping or repeating a day", () => {
    for (const month of ["2026-03", "2026-10"]) {
      const days = monthGridDays(month);
      expect(new Set(days).size).toBe(days.length);
      expect(days.length % 7).toBe(0);
    }
  });

  it("names the month and the day number", () => {
    expect(monthLabel("2026-07")).toBe("July 2026");
    expect(monthKey("2026-07-29")).toBe("2026-07");
    expect(dayNumber("2026-07-01")).toBe("1");
    expect(dayNumber("2026-07-29")).toBe("29");
  });
});

describe("labels", () => {
  it("renders event times in local clock terms", () => {
    expect(timeLabel("2026-07-29T12:30:00Z")).toBe("14:30");
    expect(timeLabel("2026-01-15T13:30:00Z")).toBe("14:30");
  });

  it("names today and tomorrow instead of printing their dates", () => {
    expect(relativeDayLabel("2026-07-29", "2026-07-29")).toBe("Today");
    expect(relativeDayLabel("2026-07-30", "2026-07-29")).toBe("Tomorrow");
    expect(relativeDayLabel("2026-07-31", "2026-07-29")).toBe("Fri 31 Jul");
  });

  it("still names tomorrow correctly across a month end", () => {
    expect(relativeDayLabel("2026-08-01", "2026-07-31")).toBe("Tomorrow");
  });
});
