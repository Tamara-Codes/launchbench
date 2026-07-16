import "server-only";
import { start } from "workflow/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { executeTenantAgentJob } from "@/workflows/tenant-agent-job";

/** Starts a Vercel Workflow only after the durable job row exists. If this
 * call fails, the queued database row remains available for a later sweeper. */
export async function dispatchTenantWorkflow(jobId: string) {
  const run = await start(executeTenantAgentJob, [jobId]);
  const admin = createAdminClient();
  const { error } = await admin.from("agent_jobs").update({ workflow_run_id: run.runId }).eq("id", jobId).eq("status", "queued");
  if (error) throw new Error(`Workflow started but its run ID could not be saved: ${error.message}`);
  return run.runId;
}
