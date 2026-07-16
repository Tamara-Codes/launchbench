import { Badge } from "./ui";
import type { LeadStatus, RunStatus } from "@/db/schema";

type Tone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

const LEAD_TONES: Record<string, { tone: Tone; label: string }> = {
  new: { tone: "neutral", label: "New" },
  awaitingReview: { tone: "warning", label: "Awaiting review" },
  approved: { tone: "info", label: "Approved" },
  rejected: { tone: "danger", label: "Rejected" },
  emailDrafted: { tone: "info", label: "Email drafted" },
  contacted: { tone: "accent", label: "Contacted" },
  followUpDue: { tone: "warning", label: "Follow-up due" },
  replied: { tone: "success", label: "Replied" },
  interested: { tone: "success", label: "Interested" },
  customer: { tone: "success", label: "Customer" },
  notInterested: { tone: "neutral", label: "Not interested" },
  optedOut: { tone: "danger", label: "Opted out" },
  invalidContact: { tone: "danger", label: "Invalid contact" },
  duplicate: { tone: "neutral", label: "Duplicate" },
};

export function LeadStatusBadge({ status }: { status: LeadStatus | string }) {
  const s = LEAD_TONES[status] ?? { tone: "neutral" as Tone, label: status };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

const RUN_TONES: Record<string, { tone: Tone; label: string }> = {
  queued: { tone: "neutral", label: "Queued" },
  planning: { tone: "info", label: "Planning" },
  searching: { tone: "info", label: "Searching" },
  deduplicating: { tone: "info", label: "Deduplicating" },
  enriching: { tone: "info", label: "Enriching" },
  qualifying: { tone: "info", label: "Qualifying" },
  generatingDrafts: { tone: "info", label: "Generating drafts" },
  completed: { tone: "success", label: "Completed" },
  completedPartial: { tone: "warning", label: "Partial" },
  failed: { tone: "danger", label: "Failed" },
  cancelled: { tone: "neutral", label: "Cancelled" },
  paused: { tone: "warning", label: "Paused" },
};

export function RunStatusBadge({ status }: { status: RunStatus | string }) {
  const s = RUN_TONES[status] ?? { tone: "neutral" as Tone, label: status };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

const DRAFT_TONES: Record<string, { tone: Tone; label: string }> = {
  draft: { tone: "neutral", label: "Draft" },
  approved: { tone: "info", label: "Approved" },
  rejected: { tone: "danger", label: "Rejected" },
  gmailDraftCreated: { tone: "accent", label: "Gmail draft" },
  sent: { tone: "success", label: "Sent" },
};

export function DraftStatusBadge({ status }: { status: string }) {
  const s = DRAFT_TONES[status] ?? { tone: "neutral" as Tone, label: status };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
