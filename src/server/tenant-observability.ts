import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type IntegrationEvent = {
  workspaceId: string;
  projectId?: string | null;
  territoryId?: string | null;
  jobId?: string | null;
  provider: "gemini" | "google_places" | "firecrawl" | "gmail";
  operation: string;
  status: "success" | "failure";
  durationMs?: number;
  requestId?: string;
  message?: string;
  metadata?: Record<string, unknown>;
};

/** Durable, queryable integration audit record. Callers decide whether a
 * logging failure should fail the operation or remain best-effort. */
export async function recordIntegrationEvent(event: IntegrationEvent) {
  const admin = createAdminClient();
  const { error } = await admin.from("integration_events").insert({
    workspace_id: event.workspaceId,
    project_id: event.projectId ?? null,
    territory_id: event.territoryId ?? null,
    job_id: event.jobId ?? null,
    provider: event.provider,
    operation: event.operation,
    status: event.status,
    duration_ms: Math.max(0, Math.round(event.durationMs ?? 0)),
    request_id: event.requestId ?? "",
    message: event.message ?? "",
    metadata: event.metadata ?? {},
  });
  if (error) throw new Error(`Could not record integration event: ${error.message}`);
}
