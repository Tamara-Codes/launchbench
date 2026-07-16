const SECRET_ENV_KEYS = [
  "GEMINI_API_KEY",
  "FIRECRAWL_API_KEY",
  "COMPOSIO_API_KEY",
  "DATABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ALERT_WEBHOOK_URL",
];

/** Redact known secret values and common key patterns from any string that
 * might be logged or surfaced in an error message. */
export function redactSecrets(input: string): string {
  let out = input;
  for (const key of SECRET_ENV_KEYS) {
    const val = process.env[key];
    if (val && val.length >= 6) {
      out = out.split(val).join(`[${key}]`);
    }
  }
  // Firecrawl keys look like fc-...; Composio/Google keys are long tokens.
  out = out.replace(/\bfc-[a-zA-Z0-9]{8,}\b/g, "[FIRECRAWL_KEY]");
  out = out.replace(/\bAIza[a-zA-Z0-9_\-]{20,}\b/g, "[GEMINI_KEY]");
  out = out.replace(/\bsk-[a-zA-Z0-9]{16,}\b/g, "[SECRET_KEY]");
  out = out.replace(/\bsb_secret_[a-zA-Z0-9_\-]{12,}\b/g, "[SUPABASE_SERVICE_ROLE_KEY]");
  return out;
}

/** Build a user-safe error message: never leak secrets, keep it short. */
export function safeErrorMessage(err: unknown): string {
  const raw =
    err instanceof Error ? err.message : typeof err === "string" ? err : "Unknown error";
  return redactSecrets(raw).slice(0, 500);
}
