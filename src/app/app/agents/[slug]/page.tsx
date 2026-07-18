import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { TenantAgentEditor } from "@/components/tenant-agent-editor";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/server/tenant-context";

export const dynamic = "force-dynamic";

export default async function AgentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const context = await getTenantContext();
  if (!context) redirect("/onboarding");

  const supabase = await createClient();
  const { data: agent } = await supabase.from("workspace_agents").select("slug, name, system_prompt, avatar_color").eq("workspace_id", context.workspace.id).eq("slug", slug).maybeSingle();
  if (!agent) notFound();

  return <main className="mx-auto max-w-6xl px-6 py-12"><Link href="/app/agents" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" />Back to agents</Link><div className="mt-5"><PageHeader title={agent.name} description="Edit the agent name, avatar color, and system prompt. Each save replaces the previous values." /></div><div className="mt-8"><TenantAgentEditor agent={agent} /></div></main>;
}
