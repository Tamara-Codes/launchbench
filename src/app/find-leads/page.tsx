import Link from "next/link";
import { Bot } from "lucide-react";
import { PageHeader, EmptyState, Button } from "@/components/ui";
import { FindLeadsClient } from "@/components/find-leads-client";
import { getActiveTerritory, getAgentBySlug, listTerritories } from "@/server/repo";
import { getActiveRun } from "@/server/run-engine";
import { getSelectedProduct } from "@/server/product-context";

export const dynamic = "force-dynamic";

export default async function FindLeadsPage() {
  const [territories, active, agent, product] = await Promise.all([
    listTerritories(),
    getActiveTerritory(),
    getAgentBySlug("accommodation-lead-finder"),
    getSelectedProduct(),
  ]);

  if (!agent || !product) {
    return (
      <div className="space-y-6">
        <PageHeader title="Find Leads" />
        <EmptyState
          icon={<Bot className="h-8 w-8" />}
          title="Setup incomplete"
          description="The lead-finder agent or product is missing. Run `npm run db:seed`."
          action={
            <Link href="/settings">
              <Button>Open settings</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const activeRun = await getActiveRun();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Find Leads"
        description="Select a town and start the Sales Agent. It continues from stored history."
      />
      <FindLeadsClient
        territories={territories.map((t) => ({
          id: t.id,
          town: t.town,
          country: t.country,
          active: t.active,
          possiblyExhausted: t.possiblyExhausted,
          confirmedExhausted: t.confirmedExhausted,
        }))}
        activeTerritoryId={active?.id ?? null}
        agentId={agent.id}
        agentEnabled={agent.enabled}
        productId={product.id}
        existingActiveRunId={activeRun?.id ?? null}
        resumableRunId={null}
      />
    </div>
  );
}
