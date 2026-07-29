import { describe, expect, it } from "vitest";
import {
  addDays,
  dayKey,
  daysFromToday,
  fromDateTimeLocalValue,
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
