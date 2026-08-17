import "server-only";
import { hasKey } from "@/env";

/** Tracing is entirely optional — every call site checks this first, so an
 * unconfigured workspace behaves exactly as if Langfuse didn't exist. */
export function isLangfuseConfigured(): boolean {
  return hasKey("LANGFUSE_PUBLIC_KEY") && hasKey("LANGFUSE_SECRET_KEY");
}

/**
 * Forces any buffered spans out immediately. Sally's run may execute inside a
 * short-lived serverless invocation, so spans left in the default batched
 * buffer would otherwise be lost — call this once at the end of a run.
 */
export async function flushLangfuseTraces(): Promise<void> {
  if (!isLangfuseConfigured()) return;
  const { langfuseSpanProcessor } = await import("../instrumentation-node");
  await langfuseSpanProcessor?.forceFlush();
}
