import type { EmailType, FollowUpStatus, LeadStatus } from "@/db/schema";

export interface FollowUpRuleValues {
  firstFollowUpDays: number;
  finalFollowUpDays: number;
  maxFollowUps: number;
  stopAfterReply: boolean;
  stopAfterOptOut: boolean;
  stopAfterInvalidAddress: boolean;
  stopAfterNotInterested: boolean;
}

export interface PlannedFollowUp {
  sequence: number;
  emailType: EmailType;
  dueAt: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Add whole days to a date without mutating the input. */
export function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * DAY_MS);
}

/**
 * Given the moment an initial email was sent, compute the schedule of
 * follow-ups. First follow-up is `firstFollowUpDays` after the initial send;
 * the final is `finalFollowUpDays` after the first. Respects `maxFollowUps`.
 */
export function planFollowUps(
  initialSentAt: Date,
  rules: FollowUpRuleValues,
): PlannedFollowUp[] {
  const plan: PlannedFollowUp[] = [];
  if (rules.maxFollowUps >= 1) {
    plan.push({
      sequence: 1,
      emailType: "follow_up_1",
      dueAt: addDays(initialSentAt, rules.firstFollowUpDays),
    });
  }
  if (rules.maxFollowUps >= 2) {
    const first = plan[0]?.dueAt ?? initialSentAt;
    plan.push({
      sequence: 2,
      emailType: "follow_up_final",
      dueAt: addDays(first, rules.finalFollowUpDays),
    });
  }
  return plan;
}

/** Should a pending follow-up be cancelled given a new lead status? Returns the
 * cancellation reason (a FollowUpStatus) or null to keep it scheduled. */
export function followUpCancellation(
  status: LeadStatus,
  rules: FollowUpRuleValues,
): FollowUpStatus | null {
  if (rules.stopAfterReply && (status === "replied" || status === "interested"))
    return "cancelledReply";
  if (rules.stopAfterOptOut && status === "optedOut") return "cancelledOptOut";
  if (rules.stopAfterNotInterested && status === "notInterested")
    return "cancelledManual";
  if (rules.stopAfterInvalidAddress && status === "invalidContact")
    return "cancelledManual";
  if (status === "customer") return "cancelledReply";
  return null;
}

export type DueBucket = "overdue" | "dueToday" | "upcoming" | "future";

/** Classify a follow-up due date relative to `now`. */
export function classifyDue(dueAt: Date, now: Date): DueBucket {
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const endToday = new Date(startToday.getTime() + DAY_MS);
  const in7 = new Date(startToday.getTime() + 7 * DAY_MS);
  if (dueAt < startToday) return "overdue";
  if (dueAt < endToday) return "dueToday";
  if (dueAt < in7) return "upcoming";
  return "future";
}
