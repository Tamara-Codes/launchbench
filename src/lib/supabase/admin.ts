import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getEnv, hasSupabaseConfig } from "@/env";

/** For trusted workers, migrations, and verified webhooks only. Never import
 * this from a route or server action that acts directly on user input. */
export function createAdminClient() {
  const env = getEnv();
  if (!hasSupabaseConfig() || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase admin access is not configured.");
  }
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
