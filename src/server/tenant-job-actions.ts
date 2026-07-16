"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getEnv } from "@/env";
import { cancelTenantJob, queueTenantJob } from "./tenant-job-service";
import { dispatchTenantWorkflow } from "./tenant-workflow-dispatch";

export async function requestTenantJob(input: unknown) {
  try {
    const job = await queueTenantJob(input);
    if (getEnv().WORKFLOWS_ENABLED === "true") await dispatchTenantWorkflow(job.id);
    revalidatePath("/app/jobs");
    return { ok: true as const, data: job };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Could not queue job." };
  }
}

export async function requestTenantJobCancellation(jobId: string) {
  try {
    await cancelTenantJob(z.string().uuid().parse(jobId));
    revalidatePath("/app/jobs");
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Could not cancel job." };
  }
}
