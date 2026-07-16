import type { RunStatus } from "@/db/schema";

/**
 * Deterministic state machine for a lead-search run. Defines the legal
 * forward transitions plus the terminal states. Used to guard progress
 * updates and to decide whether an interrupted run can be resumed.
 */
export const RUN_STAGES: RunStatus[] = [
  "queued",
  "planning",
  "searching",
  "deduplicating",
  "enriching",
  "qualifying",
  "generatingDrafts",
  "completed",
];

const TRANSITIONS: Record<RunStatus, RunStatus[]> = {
  queued: ["planning", "cancelled", "failed"],
  planning: ["searching", "cancelled", "failed", "paused"],
  searching: ["deduplicating", "cancelled", "failed", "paused"],
  deduplicating: ["enriching", "cancelled", "failed", "paused"],
  enriching: ["qualifying", "cancelled", "failed", "paused"],
  qualifying: [
    "generatingDrafts",
    "completed",
    "completedPartial",
    "cancelled",
    "failed",
    "paused",
  ],
  generatingDrafts: ["completed", "completedPartial", "cancelled", "failed"],
  paused: ["planning", "searching", "deduplicating", "enriching", "qualifying", "cancelled"],
  completed: [],
  completedPartial: [],
  failed: [],
  cancelled: [],
};

export const TERMINAL_STATUSES: RunStatus[] = [
  "completed",
  "completedPartial",
  "failed",
  "cancelled",
];

export const ACTIVE_STATUSES: RunStatus[] = [
  "queued",
  "planning",
  "searching",
  "deduplicating",
  "enriching",
  "qualifying",
  "generatingDrafts",
];

export function isTerminal(status: RunStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export function isActive(status: RunStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

/** Can we move from -> to? Terminal states never transition. */
export function canTransition(from: RunStatus, to: RunStatus): boolean {
  if (from === to) return true;
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/** A run that was left in an active (non-terminal) state — e.g. the app was
 * closed mid-run — is resumable. */
export function isResumable(status: RunStatus): boolean {
  return isActive(status) || status === "paused";
}
