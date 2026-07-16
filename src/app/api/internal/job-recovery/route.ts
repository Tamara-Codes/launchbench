import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "@/env";
import { reportOperationalError } from "@/lib/observability";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchTenantWorkflow } from "@/server/tenant-workflow-dispatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: NextRequest) {
  const secret = getEnv().CRON_SECRET; const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || supplied.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(supplied), Buffer.from(secret));
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const admin = createAdminClient(); await admin.rpc("requeue_expired_agent_jobs");
    const { data: queued, error } = await admin.from("agent_jobs").select("id").eq("status", "queued").eq("workflow_run_id", "").lte("not_before", new Date().toISOString()).limit(25);
    if (error) throw new Error(error.message);
    const dispatched = await Promise.allSettled((queued ?? []).map((job) => dispatchTenantWorkflow(job.id)));
    const failed = dispatched.filter((item) => item.status === "rejected").length;
    return NextResponse.json({ recovered: queued?.length ?? 0, dispatchFailures: failed });
  } catch (error) {
    await reportOperationalError("job_recovery_failed", error);
    return NextResponse.json({ error: "Recovery failed" }, { status: 500 });
  }
}
