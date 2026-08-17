import { notFound, redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, PageHeader } from "@/components/ui";
import { TenantTemplateEditor } from "@/components/tenant-template-editor";
import { TenantEmailPersonaForm } from "@/components/tenant-email-persona-form";
import { ProjectNav } from "@/components/project-nav";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/server/tenant-context";

export const dynamic = "force-dynamic";

export default async function ProjectTemplatesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const context = await getTenantContext(); if (!context) redirect("/onboarding");
  const supabase = await createClient();
  const [{ data: project }, { data: templates }, { data: agents }] = await Promise.all([
    supabase.from("projects").select("id, name, preferred_language, email_generation_context, preferred_cta, sender_gender, sender_signature").eq("id", id).eq("workspace_id", context.workspace.id).maybeSingle(),
    supabase.from("email_templates").select("language, sequence_step, name, subject, body").eq("project_id", id).eq("workspace_id", context.workspace.id).order("sequence_step"),
    supabase.from("workspace_agents").select("slug,name").eq("workspace_id", context.workspace.id),
  ]);
  if (!project) notFound();
  const sally = agents?.find((agent) => agent.slug === "sales-agent")?.name ?? "Sally";
  const contessa = agents?.find((agent) => agent.slug === "content-agent")?.name ?? "Contessa";
  return <main className="mx-auto w-full max-w-7xl px-6 py-6"><PageHeader title={project.name} /><ProjectNav projectId={project.id} active="templates" salesAgentName={sally} contentAgentName={contessa} /><div className="mt-4"><TenantEmailPersonaForm projectId={project.id} initial={{ emailGenerationContext: project.email_generation_context, preferredCta: project.preferred_cta, senderGender: project.sender_gender, senderSignature: project.sender_signature }} /></div><Card className="mt-4"><CardHeader className="p-4 pb-2"><CardTitle>Email templates</CardTitle><p className="text-sm text-muted">Templates the Sales Agent uses to write email drafts for {project.name}.</p></CardHeader><CardContent className="p-4 pt-0"><TenantTemplateEditor projectId={project.id} templates={templates ?? []} language={project.preferred_language} /></CardContent></Card></main>;
}
