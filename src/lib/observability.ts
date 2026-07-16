import "server-only";
import { getEnv } from "@/env";
import { safeErrorMessage } from "./redact";
import { redactSecrets } from "./redact";

type LogFields = Record<string, unknown>;

function write(level: "info" | "warn" | "error", event: string, fields: LogFields = {}) {
  const safeFields = Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, typeof value === "string" ? redactSecrets(value).slice(0, 2_000) : value]));
  const record = JSON.stringify({ timestamp: new Date().toISOString(), level, event, ...safeFields });
  if (level === "error") console.error(record);
  else if (level === "warn") console.warn(record);
  else console.info(record);
}

export const log = {
  info: (event: string, fields?: LogFields) => write("info", event, fields),
  warn: (event: string, fields?: LogFields) => write("warn", event, fields),
  error: (event: string, fields?: LogFields) => write("error", event, fields),
};

/** Optional JSON webhook for incidents. It never includes prompts, webpage
 * content, tokens, or secrets; Vercel's structured logs remain the source of
 * truth if no alert destination is configured. */
export async function reportOperationalError(event: string, error: unknown, fields: LogFields = {}) {
  const message = safeErrorMessage(error);
  log.error(event, { ...fields, message });
  const env = getEnv();
  if (env.OPERATIONAL_ALERTS_ENABLED !== "true" || !env.ALERT_WEBHOOK_URL) return;
  try {
    await fetch(env.ALERT_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event, message, timestamp: new Date().toISOString(), ...fields }),
      signal: AbortSignal.timeout(5_000),
    });
  } catch (alertError) {
    log.error("operational_alert_delivery_failed", { event, message: safeErrorMessage(alertError) });
  }
}
