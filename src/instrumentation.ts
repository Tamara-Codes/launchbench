/**
 * Next.js instrumentation hook — runs once when a server instance starts,
 * before it accepts requests. Sets up Langfuse/OpenTelemetry tracing.
 *
 * The OTel Node SDK isn't Edge-safe, so it's gated to the Node runtime and
 * loaded from a separate file (`instrumentation-node.ts`) rather than
 * imported at the top of this one.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
