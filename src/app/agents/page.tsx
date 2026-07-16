import Link from "next/link";
import { Bot, ArrowRight } from "lucide-react";
import { Badge, Card, CardContent, EmptyState, PageHeader } from "@/components/ui";
import { listAgents } from "@/server/repo";
import { agentModelSettings, providerLabel } from "@/lib/agent-models";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const agents = await listAgents();
  return (
    <div className="space-y-6">
      <PageHeader title="Agents" description="Installed agents. The architecture supports adding more later." />
      {agents.length === 0 ? (
        <EmptyState icon={<Bot className="h-8 w-8" />} title="No agents installed" description="Run `npm run db:seed`." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {agents.map((a) => (
            (() => { const settings = agentModelSettings(a.configuration, a.model, "gemini"); return (
            <Link key={a.id} href={`/agents/${a.slug}`}>
              <Card className="h-full transition-colors hover:border-accent">
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft text-accent">
                        <Bot className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-ink-strong">{a.name}</p>
                        <p className="text-xs text-muted">{providerLabel[settings.textProvider]} · {a.model}</p>
                      </div>
                    </div>
                    <Badge tone={a.enabled ? "success" : "neutral"}>{a.enabled ? "Enabled" : "Disabled"}</Badge>
                  </div>
                  <p className="mt-3 text-sm text-muted">{a.description}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-sm text-accent">
                    Configure <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </CardContent>
              </Card>
            </Link>
            ); })()
          ))}
        </div>
      )}
    </div>
  );
}
