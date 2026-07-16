import type { RunStats } from "@/db/schema";

/** Progress event emitted during a run (persisted to the audit log + surfaced
 * in the live run view). Never contains model chain-of-thought — operational
 * events and validated outcomes only. */
export interface RunEvent {
  message: string;
  stage?: string;
}

export interface AgentRunContext<TInput> {
  runId: string;
  input: TInput;
  /** Emit a concise operational progress line. */
  emit: (event: RunEvent) => Promise<void>;
  /** Cooperative cancellation — checked between candidates. */
  isCancelled: () => Promise<boolean>;
}

export interface AgentRunResult {
  qualified: number;
  manualReview: number;
  rejected: number;
  duplicates: number;
  stats: RunStats;
  exhaustionSignal: string;
}

/**
 * Contract every agent implementation satisfies. Deliberately minimal: this is
 * NOT a general autonomous-agent framework — each agent validates its own
 * input and runs a deterministic `execute`.
 */
export interface AgentDefinition<TInput, TOutput> {
  slug: string;
  agentType: string;
  validateInput(input: unknown): TInput;
  execute(context: AgentRunContext<TInput>): Promise<TOutput>;
}
