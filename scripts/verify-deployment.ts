import { getEnv, hasSupabaseConfig } from "../src/env";

const env = getEnv();
const failures: string[] = [];
if (process.env.VERCEL_ENV === "production") {
  if (!hasSupabaseConfig()) failures.push("Supabase URL and publishable key are required.");
  if (!env.SUPABASE_SERVICE_ROLE_KEY) failures.push("SUPABASE_SERVICE_ROLE_KEY is required server-side.");
  if (!env.GEMINI_API_KEY) failures.push("GEMINI_API_KEY is required for agent execution.");
  if (!env.NEXT_PUBLIC_APP_URL.startsWith("https://")) failures.push("NEXT_PUBLIC_APP_URL must use HTTPS in production.");
  if (env.NEXT_PUBLIC_APP_URL.includes("localhost")) failures.push("NEXT_PUBLIC_APP_URL cannot point to localhost in production.");
  if (env.WORKFLOWS_ENABLED !== "true") failures.push("WORKFLOWS_ENABLED must be true for production agent execution.");
  if (!env.CRON_SECRET) failures.push("CRON_SECRET is required for expired-job recovery.");
}
if (failures.length) {
  console.error(`Deployment verification failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.info("Deployment environment verification passed.");
