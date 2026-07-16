import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { AgentEditor } from "@/components/agent-editor";
import { getAgentBySlug, getAgentVersions } from "@/server/repo";
import { agentModelSettings } from "@/lib/agent-models";

export const dynamic = "force-dynamic";

export default async function AgentDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const agent = await getAgentBySlug(slug);
  if (!agent) notFound();
  const versions = await getAgentVersions(agent.id);
  const modelSettings = agentModelSettings(agent.configuration, agent.model, "gemini");

  return (
    <div className="space-y-6">
      <Link href="/agents" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Back to agents
      </Link>
      <PageHeader
        title={agent.name}
        description="Edit prompts and model settings. Every save creates a restorable version. Executable code is never allowed here."
      />
      <AgentEditor
        slug={agent.slug}
        initial={{
          systemPrompt: agent.systemPrompt,
          taskPromptTemplate: agent.taskPromptTemplate,
          model: agent.model,
          temperature: agent.temperature,
          enabled: agent.enabled,
          textProvider: modelSettings.textProvider,
          imageProvider: modelSettings.imageProvider,
          imageModel: modelSettings.imageModel,
        }}
        versions={versions.map((v) => ({
          id: v.id,
          version: v.version,
          note: v.note,
          createdAt: v.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
