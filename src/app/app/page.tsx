import { redirect } from "next/navigation";
import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function WorkspaceHomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("role, workspaces(id, name, slug)")
    .order("created_at")
    .limit(20);
  if (!memberships?.length) redirect("/onboarding");
  const active = memberships[0]?.workspaces as unknown as { id: string; name: string; slug: string } | null;
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex items-start justify-between gap-4"><div><p className="text-sm text-muted">Workspace</p><h1 className="text-3xl font-semibold text-ink-strong">{active?.name}</h1><p className="mt-2 text-muted">Your tenant-safe workspace is ready. Agent screens will be added here as their data flows are migrated.</p></div><SignOutButton /></div>
      <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Link href="/app/products" className="rounded-xl border bg-surface p-5 transition-colors hover:border-accent"><h2 className="font-semibold">Products</h2><p className="mt-2 text-sm text-muted">Create and manage product-specific sales context and templates.</p></Link><Link href="/app/sales" className="rounded-xl border bg-surface p-5 transition-colors hover:border-accent"><h2 className="font-semibold">Sales Agent</h2><p className="mt-2 text-sm text-muted">Define territories, run research, and review leads.</p></Link><Link href="/app/content" className="rounded-xl border bg-surface p-5 transition-colors hover:border-accent"><h2 className="font-semibold">Content Studio</h2><p className="mt-2 text-sm text-muted">Generate product-aware captions and images.</p></Link><Link href="/app/settings" className="rounded-xl border bg-surface p-5 transition-colors hover:border-accent"><h2 className="font-semibold">Sender profile</h2><p className="mt-2 text-sm text-muted">Set the workspace-wide sender identity and signature.</p></Link><Link href="/app/jobs" className="rounded-xl border bg-surface p-5 transition-colors hover:border-accent"><h2 className="font-semibold">Agent jobs</h2><p className="mt-2 text-sm text-muted">Track durable Sales and Content Agent work.</p></Link></section>
      <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Link href="/app/products" className="rounded-xl border bg-surface p-5 transition-colors hover:border-accent"><h2 className="font-semibold">Products</h2><p className="mt-2 text-sm text-muted">Create and manage product-specific sales context and templates.</p></Link><Link href="/app/sales" className="rounded-xl border bg-surface p-5 transition-colors hover:border-accent"><h2 className="font-semibold">Sales Agent</h2><p className="mt-2 text-sm text-muted">Define territories, run research, and review leads.</p></Link><Link href="/app/content" className="rounded-xl border bg-surface p-5 transition-colors hover:border-accent"><h2 className="font-semibold">Content Studio</h2><p className="mt-2 text-sm text-muted">Generate product-aware captions and images.</p></Link><Link href="/app/media" className="rounded-xl border bg-surface p-5 transition-colors hover:border-accent"><h2 className="font-semibold">Media library</h2><p className="mt-2 text-sm text-muted">Keep private product assets inside your workspace.</p></Link><Link href="/app/settings" className="rounded-xl border bg-surface p-5 transition-colors hover:border-accent"><h2 className="font-semibold">Sender profile</h2><p className="mt-2 text-sm text-muted">Set the workspace-wide sender identity and signature.</p></Link><Link href="/app/jobs" className="rounded-xl border bg-surface p-5 transition-colors hover:border-accent"><h2 className="font-semibold">Agent jobs</h2><p className="mt-2 text-sm text-muted">Track durable Sales and Content Agent work.</p></Link></section>
    </main>
  );
}
