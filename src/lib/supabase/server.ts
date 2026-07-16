import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getEnv, hasSupabaseConfig } from "@/env";

/** Server client bound to the current user's cookie session. Queries made with
 * this client are subject to Supabase RLS policies. */
export async function createClient() {
  if (!hasSupabaseConfig()) {
    throw new Error("Supabase is not configured. Set the Supabase environment variables before enabling SaaS mode.");
  }
  const store = await cookies();
  const env = getEnv();
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(values) {
        try {
          values.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Server Components cannot write cookies. middleware.ts refreshes
          // sessions before the request reaches them.
        }
      },
    },
  });
}
