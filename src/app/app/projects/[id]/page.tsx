import { notFound, redirect } from "next/navigation";
import { Card, CardContent, PageHeader } from "@/components/ui";
import { TenantProjectForm } from "@/components/tenant-project-form";
import { ProjectNav } from "@/components/project-nav";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/server/tenant-context";

export const dynamic = "force-dynamic";

export default async function TenantProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const context = await getTenantContext();
  if (!context) redirect("/onboarding");

  const initialContext =
    tab === "sally" ? "sales" : tab === "contessa" ? "content" : "basics";
  const supabase = await createClient();
  const [{ data: project }, { data: agents }] = await Promise.all([
    supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .eq("workspace_id", context.workspace.id)
      .maybeSingle(),
    supabase
      .from("workspace_agents")
      .select("slug,name")
      .eq("workspace_id", context.workspace.id),
  ]);
  if (!project) notFound();

  const salesAgent = agents?.find((agent) => agent.slug === "sales-agent");
  const contentAgent = agents?.find((agent) => agent.slug === "content-agent");
  const sally = salesAgent?.name ?? "Sally";
  const contessa = contentAgent?.name ?? "Contessa";
  const navTab = initialContext === "sales" ? "sales" : initialContext === "content" ? "content" : "basics";

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-12">
      <div>
        <PageHeader title={project.name} />
      </div>
      <ProjectNav projectId={project.id} active={navTab} salesAgentName={sally} contentAgentName={contessa} />
      <Card className="mt-6">
        <CardContent className="pt-5">
          <TenantProjectForm
            project={project}
            salesAgentName={sally}
            contentAgentName={contessa}
            initialContext={initialContext}
          />
        </CardContent>
      </Card>
    </main>
  );
}
