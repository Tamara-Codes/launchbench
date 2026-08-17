import { notFound, redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, PageHeader } from "@/components/ui";
import { ProjectBoard } from "@/components/ops-todo-board";
import { ProjectNav } from "@/components/project-nav";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/server/tenant-context";
import { loadTodoBoard } from "@/server/ops-cockpit";
import { dayKey } from "@/lib/ops-dates";

export const dynamic = "force-dynamic";

export default async function ProjectTasksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const context = await getTenantContext(); if (!context) redirect("/onboarding");
  const supabase = await createClient();
  const [{ data: project }, { data: agents }, board] = await Promise.all([
    supabase.from("projects").select("id, name").eq("id", id).eq("workspace_id", context.workspace.id).maybeSingle(),
    supabase.from("workspace_agents").select("slug,name").eq("workspace_id", context.workspace.id),
    loadTodoBoard(context.workspace.id),
  ]);
  if (!project) notFound();
  const sally = agents?.find((agent) => agent.slug === "sales-agent")?.name ?? "Sally";
  const contessa = agents?.find((agent) => agent.slug === "content-agent")?.name ?? "Contessa";
  const group = board.groups.find((candidate) => candidate.project?.id === project.id) ?? { project, backlog: [], inProgress: [], done: [] };
  return <main className="mx-auto w-full max-w-7xl px-6 py-6"><PageHeader title={project.name} /><ProjectNav projectId={project.id} active="tasks" salesAgentName={sally} contentAgentName={contessa} /><Card className="mt-4"><CardHeader className="p-4 pb-2"><CardTitle>Tasks</CardTitle><p className="text-sm text-muted">The full backlog for {project.name}.</p></CardHeader><CardContent className="p-4 pt-0"><ProjectBoard group={group} today={dayKey()} projects={board.projects} /></CardContent></Card></main>;
}
