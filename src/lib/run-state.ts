export type RunStatus =
  | "queued" | "planning" | "searching" | "deduplicating" | "enriching"
  | "qualifying" | "generatingDrafts" | "completed" | "completedPartial"
  | "failed" | "cancelled" | "paused";

export const TERMINAL_STATUSES: RunStatus[] = ["completed", "completedPartial", "failed", "cancelled"];
export const ACTIVE_STATUSES: RunStatus[] = ["queued", "planning", "searching", "deduplicating", "enriching", "qualifying", "generatingDrafts"];

const transitions: Partial<Record<RunStatus, RunStatus[]>> = {
  queued: ["planning", "cancelled", "failed"], planning: ["searching", "cancelled", "failed", "paused"],
  searching: ["deduplicating", "cancelled", "failed", "paused"], deduplicating: ["enriching", "cancelled", "failed", "paused"],
  enriching: ["qualifying", "cancelled", "failed", "paused"], qualifying: ["generatingDrafts", "completed", "completedPartial", "cancelled", "failed", "paused"],
  generatingDrafts: ["completed", "completedPartial", "cancelled", "failed"], paused: ["planning", "searching", "deduplicating", "enriching", "qualifying", "cancelled"],
};

export function isTerminal(status: RunStatus) { return TERMINAL_STATUSES.includes(status); }
export function isActive(status: RunStatus) { return ACTIVE_STATUSES.includes(status); }
export function canTransition(from: RunStatus, to: RunStatus) { return from === to || transitions[from]?.includes(to) === true; }
export function isResumable(status: RunStatus) { return isActive(status) || status === "paused"; }
