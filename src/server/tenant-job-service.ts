import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "./tenant-context";

export const jobRequestSchema = z.object({
  kind: z.enum(["lead_search", "content_generation", "gmail_sync", "send_email", "prepare_follow_ups"]),
  productId: z.string().uuid().optional(),
  input: z.record(z.string(), z.unknown()).default({}),
  idempotencyKey: z.string().trim().min(8).max(160).optional(),
});

const MAX_JOB_INPUT_BYTES = 64 * 1024;

/** Creates a durable job record. Dispatching is intentionally separate: if a
 * workflow provider is unavailable, the queued row remains recoverable. */
export async function queueTenantJob(input: unknown) {
  const request = jobRequestSchema.parse(input);
  const context = await getTenantContext();
  if (!context) throw new Error("Create a workspace before requesting agent work.");
  if (context.role === "member") throw new Error("Only workspace owners and admins can run agents.");
  const inputSize = Buffer.byteLength(JSON.stringify(request.input), "utf8");
  if (inputSize > MAX_JOB_INPUT_BYTES) throw new Error("Job input is too large.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("request_agent_job", {
    requested_product_id: request.productId ?? null,
    requested_kind: request.kind,
    requested_input: request.input,
    requested_idempotency_key: request.idempotencyKey ?? randomUUID(),
  });
  const job = Array.isArray(data) ? data[0] : data;
  if (error || !job) throw new Error(error?.message ?? "Could not queue agent job.");
  return job;
}

export async function cancelTenantJob(jobId: string) {
  const context = await getTenantContext();
  if (!context) throw new Error("Not authorized.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_agent_job", { job_id: jobId });
  if (error) throw new Error(error.message);
}
