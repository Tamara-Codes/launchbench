export type EmailType = "initial" | "follow_up_1" | "follow_up_final";
export type LeadStatus = "replied" | "interested" | "optedOut" | "notInterested" | "invalidContact" | "customer" | string;
export type FollowUpStatus = "cancelledReply" | "cancelledOptOut" | "cancelledManual";
export interface FollowUpRuleValues { firstFollowUpDays: number; finalFollowUpDays: number; maxFollowUps: number; stopAfterReply: boolean; stopAfterOptOut: boolean; stopAfterInvalidAddress: boolean; stopAfterNotInterested: boolean; }
export interface PlannedFollowUp { sequence: number; emailType: EmailType; dueAt: Date; }
const DAY_MS = 86_400_000;
export function addDays(from: Date, days: number) { return new Date(from.getTime() + days * DAY_MS); }
export function planFollowUps(initialSentAt: Date, rules: FollowUpRuleValues): PlannedFollowUp[] { const plan: PlannedFollowUp[] = []; if (rules.maxFollowUps >= 1) plan.push({ sequence: 1, emailType: "follow_up_1", dueAt: addDays(initialSentAt, rules.firstFollowUpDays) }); if (rules.maxFollowUps >= 2) plan.push({ sequence: 2, emailType: "follow_up_final", dueAt: addDays(plan[0]?.dueAt ?? initialSentAt, rules.finalFollowUpDays) }); return plan; }
export function followUpCancellation(status: LeadStatus, rules: FollowUpRuleValues): FollowUpStatus | null { if (rules.stopAfterReply && (status === "replied" || status === "interested" || status === "customer")) return "cancelledReply"; if (rules.stopAfterOptOut && status === "optedOut") return "cancelledOptOut"; if ((rules.stopAfterNotInterested && status === "notInterested") || (rules.stopAfterInvalidAddress && status === "invalidContact")) return "cancelledManual"; return null; }
export type DueBucket = "overdue" | "dueToday" | "upcoming" | "future";
export function classifyDue(dueAt: Date, now: Date): DueBucket { const start = new Date(now); start.setHours(0, 0, 0, 0); if (dueAt < start) return "overdue"; if (dueAt < new Date(start.getTime() + DAY_MS)) return "dueToday"; if (dueAt < new Date(start.getTime() + 7 * DAY_MS)) return "upcoming"; return "future"; }
