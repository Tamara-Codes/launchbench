import { LoginForm } from "@/components/login-form";
import { hasSupabaseConfig } from "@/env";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  if (!hasSupabaseConfig()) {
    return <main className="mx-auto max-w-xl px-6 py-20"><h1 className="text-2xl font-semibold">Supabase is not connected yet</h1><p className="mt-3 text-muted">Add the Supabase project URL and publishable key to enable sign-in.</p></main>;
  }
  return <main className="px-6 py-20"><LoginForm /></main>;
}
