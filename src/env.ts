import { z } from "zod";

const optionalUrl = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().url().optional().transform((value) => value ?? ""),
);
const optionalSecret = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().min(24).optional().transform((value) => value ?? ""),
);

/**
 * Server-only environment validation. Import this ONLY from server code
 * (route handlers, scripts, server components). Never from client components.
 *
 * Missing/invalid variables produce a helpful message WITHOUT printing secret
 * values. Provider keys are optional so the app boots and the UI can guide the
 * user through configuration; each provider validates its own key at call time.
 */
const schema = z.object({
  GEMINI_MODEL: z.string().min(1).default("gemini-3.5-flash"),
  GEMINI_API_KEY: z.string().optional().default(""),
  FIRECRAWL_API_KEY: z.string().optional().default(""),
  GOOGLE_PLACES_API_KEY: z.string().optional().default(""),
  GOOGLE_CSE_API_KEY: z.string().optional().default(""),
  GOOGLE_CSE_ID: z.string().optional().default(""),
  COMPOSIO_API_KEY: z.string().optional().default(""),
  COMPOSIO_AUTH_CONFIG_ID: z.string().optional().default(""),
  NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().optional().default(""),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().default(""),
  WORKFLOWS_ENABLED: z.enum(["true", "false"]).optional().default("false"),
  ALERT_WEBHOOK_URL: optionalUrl,
  OPERATIONAL_ALERTS_ENABLED: z.enum(["true", "false"]).optional().default("false"),
  CRON_SECRET: optionalSecret,
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const keys = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    // Never echo the offending values — only the names.
    throw new Error(
      `Invalid environment configuration. Check these variables: ${keys}. ` +
        `See .env.example and create a .env.local file.`,
    );
  }
  cached = parsed.data;
  return cached;
}

/** True when a provider key is present (non-empty). */
export function hasKey(name: keyof Env): boolean {
  const v = getEnv()[name];
  return typeof v === "string" && v.trim().length > 0;
}

/** True when the Supabase application is configured. */
export function hasSupabaseConfig(): boolean {
  const env = getEnv();
  return Boolean(
    env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
