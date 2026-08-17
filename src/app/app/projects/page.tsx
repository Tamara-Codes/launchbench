import Link from "next/link";
import { redirect } from "next/navigation";
import { Button, Card, CardContent, PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/server/tenant-context";

export const dynamic = "force-dynamic";

export default async function TenantProjectsPage() {
  const context = await getTenantContext();
  if (!context) redirect("/onboarding");
  const supabase = await createClient();
  const { data: projects } = await supabase.from("projects").select("id, name, full_description, active, preferred_language").eq("workspace_id", context.workspace.id).order("name");
  return <main className="mx-auto w-full max-w-7xl px-6 py-12"><div className="flex items-start justify-between gap-4"><PageHeader title="Projects" description="Each project keeps its own verified sales context." /><Link href="/app/projects/new"><Button>Add project</Button></Link></div><div className="mt-8 grid gap-4 sm:grid-cols-2">{projects?.map((project) => <Link key={project.id} href={`/app/projects/${project.id}`}><Card className="h-full transition-colors hover:border-accent"><CardContent className="pt-5"><p className="font-semibold text-ink-strong">{project.name}</p><p className="mt-1 text-sm text-muted">{project.full_description || "Add verified project context."}</p><p className="mt-4 text-xs uppercase text-muted">{project.preferred_language} · {project.active ? "Active" : "Inactive"}</p></CardContent></Card></Link>)}</div>{!projects?.length && <p className="mt-8 text-muted">No projects yet. Add the first offer your agents should work on.</p>}</main>;
}
