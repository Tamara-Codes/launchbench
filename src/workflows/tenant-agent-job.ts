import { claimTenantJob, completeTenantJob, failTenantJob } from "@/server/tenant-job-worker";
import { runTenantSalesJob } from "@/server/tenant-sales-runner";
import { runTenantContentJob } from "@/server/tenant-content-runner";
import { reportOperationalError } from "@/lib/observability";

/**
 * Durable Vercel Workflow entry point. Keeping the argument to one job ID is
 * intentional: workflow history never contains customer data, access tokens,
 * scrape contents, or Gemini prompts.
 */
export async function executeTenantAgentJob(jobId: string) {
  "use workflow";

  const job = await claimJob(jobId);
  if (!job) return { status: "already_claimed_or_cancelled" as const };
  try {
    if (job.kind === "lead_search") {
      await runSalesJob(job);
      return { status: "completed" as const };
    }
    if (job.kind === "content_generation") {
      await runContentJob(job);
      return { status: "completed" as const };
    }
    throw new Error(`No tenant workflow handler is registered for ${job.kind}.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tenant job failed.";
    await reportOperationalError("tenant_job_failed", error, { jobId: job.id, jobKind: job.kind, workspaceId: job.workspace_id });
    await markFailed(job, message);
    return { status: "failed" as const, message };
  }
}

async function runContentJob(job: NonNullable<Awaited<ReturnType<typeof claimTenantJob>>>) {
  "use step";
  await runTenantContentJob(job);
}

async function claimJob(jobId: string) {
  "use step";
  return claimTenantJob(jobId);
}

async function markFailed(job: NonNullable<Awaited<ReturnType<typeof claimTenantJob>>>, message: string) {
  "use step";
  await failTenantJob(job, message);
}

async function runSalesJob(job: NonNullable<Awaited<ReturnType<typeof claimTenantJob>>>) {
  "use step";
  await runTenantSalesJob(job);
}

async function markCompleted(job: NonNullable<Awaited<ReturnType<typeof claimTenantJob>>>, result: Record<string, unknown>) {
  "use step";
  await completeTenantJob(job, result);
}
