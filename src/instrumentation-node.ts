import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";

/**
 * Reads process.env directly rather than the app's validated `getEnv()` —
 * this module is imported from `register()` at server boot, before a request
 * context exists, and must not depend on the rest of the app's env schema.
 */
const isConfigured = Boolean(process.env.LANGFUSE_PUBLIC_KEY?.trim() && process.env.LANGFUSE_SECRET_KEY?.trim());

/**
 * Null when Langfuse isn't configured, so every call site (gemini.ts, the
 * Sally runner) is a true no-op instead of throwing on missing credentials.
 * Exported so a background job can `forceFlush()` before it exits — spans
 * are batched by default and would otherwise be lost when the process ends.
 */
export const langfuseSpanProcessor = isConfigured ? new LangfuseSpanProcessor() : null;

if (langfuseSpanProcessor) {
  new NodeSDK({ spanProcessors: [langfuseSpanProcessor] }).start();
}
