import { LoginForm } from "@/components/login-form";
import { LoginAnimation } from "@/components/login-animation";
import { hasSupabaseConfig } from "@/env";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  if (!hasSupabaseConfig()) {
    return <main className="mx-auto max-w-xl px-6 py-20"><h1 className="text-2xl font-semibold">Supabase is not connected yet</h1><p className="mt-3 text-muted">Add the Supabase project URL and publishable key to enable sign-in.</p></main>;
  }
  return <main className="grid min-h-[100dvh] md:grid-cols-2"><section className="flex min-h-[42dvh] flex-col items-center justify-center bg-[#15191f] px-7 py-10 text-center sm:px-12 md:min-h-0 md:px-16"><div className="flex flex-col items-center"><LoginAnimation /><p className="mt-6 text-3xl font-semibold tracking-tight text-ink-strong">Launch<span className="text-accent">Bench</span></p><p className="mt-3 max-w-xs text-sm leading-6 text-muted">A focused workspace for sales outreach and content creation.</p></div></section><section className="flex items-center bg-[#111316] px-7 py-12 sm:px-12 md:px-16 lg:px-24"><div className="mx-auto w-full max-w-md"><p className="text-sm font-medium text-accent">Welcome back</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink-strong">Sign in to your workspace</h1><p className="mt-3 text-sm leading-6 text-muted">Use the account connected to your LaunchBench workspace.</p><div className="mt-8"><LoginForm /></div></div></section></main>;
}
