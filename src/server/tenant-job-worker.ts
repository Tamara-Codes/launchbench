import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export type ClaimedTenantJob = {
  id: string;
  workspace_id: string;
  product_id: string | null;
  kind: "lead_search" | "content_generation" | "gmail_sync" | "send_email" | "prepare_follow_ups";
  input: Record<string, unknown>;
  attempt_count: number;
  max_attempts: number;
  cancel_requested: boolean;
};

/** Claims exactly one queued job. A workflow receives only the job ID and uses
 * this server-only helper to load all tenant data after acquiring a lease. */
export async function claimTenantJob(jobId: string): Promise<ClaimedTenantJob | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_agent_job", {
    job_id: jobId,
    worker_token: randomUUID(),
    lease_seconds: 300,
  });
  if (error) throw new Error(`Could not claim job: ${error.message}`);
  return data as ClaimedTenantJob | null;
}

export async function appendTenantJobEvent(job: Pick<ClaimedTenantJob, "id" | "workspace_id">, eventType: "progress" | "completed" | "failed", message: string, metadata: Record<string, unknown> = {}) {
  const admin = createAdminClient();
  const { error } = await admin.from("agent_job_events").insert({ job_id: job.id, workspace_id: job.workspace_id, event_type: eventType, message, metadata });
  if (error) throw new Error(`Could not record job event: ${error.message}`);
}

export async function completeTenantJob(job: Pick<ClaimedTenantJob, "id" | "workspace_id">, result: Record<string, unknown> = {}) {
  const admin = createAdminClient();
  const { data, error } = await admin.from("agent_jobs").update({ status: "completed", result, completed_at: new Date().toISOString(), lease_token: null, lease_expires_at: null })
    .eq("id", job.id).eq("workspace_id", job.workspace_id).eq("status", "running").eq("cancel_requested", false).select("id").maybeSingle();
  if (error) throw new Error(`Could not complete job: ${error.message}`);
  if (!data) return false; // A cancellation won the race; never overwrite it.
  await appendTenantJobEvent(job, "completed", "Job completed.");
  return true;
}

export async function failTenantJob(job: Pick<ClaimedTenantJob, "id" | "workspace_id">, message: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.from("agent_jobs").update({ status: "failed", error: message.slice(0, 2_000), completed_at: new Date().toISOString(), lease_token: null, lease_expires_at: null })
    .eq("id", job.id).eq("workspace_id", job.workspace_id).eq("status", "running").eq("cancel_requested", false).select("id").maybeSingle();
  if (error) throw new Error(`Could not fail job: ${error.message}`);
  if (!data) return false; // The job was cancelled or already finalized.
  await appendTenantJobEvent(job, "failed", message);
  return true;
}

export async function isTenantJobCancellationRequested(job: Pick<ClaimedTenantJob, "id" | "workspace_id">) {
  const admin = createAdminClient();
  const { data, error } = await admin.from("agent_jobs").select("status, cancel_requested")
    .eq("id", job.id).eq("workspace_id", job.workspace_id).maybeSingle();
  if (error) throw new Error(`Could not check job cancellation: ${error.message}`);
  return !data || data.cancel_requested || data.status === "cancelled";
}
