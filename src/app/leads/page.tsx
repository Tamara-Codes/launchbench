import Link from "next/link";
import { Users, Mail, Globe } from "lucide-react";
import {
  Card,
  CardContent,
  EmptyState,
  PageHeader,
  Table,
  Thead,
  Th,
  Td,
  Tr,
} from "@/components/ui";
import { LeadStatusBadge } from "@/components/status";
import { LeadsToolbar } from "@/components/leads-toolbar";
import { listLeads, listTerritories, getActiveTerritory } from "@/server/repo";
import type { LeadStatus } from "@/db/schema";
import { formatDate } from "@/lib/utils";
import { getSelectedProduct } from "@/server/product-context";

export const dynamic = "force-dynamic";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const [territories, active, product] = await Promise.all([listTerritories(), getActiveTerritory(), getSelectedProduct()]);
  const leads = await listLeads({
    productId: product?.id,
    status: (sp.status as LeadStatus) || undefined,
    territoryId: sp.territoryId || undefined,
    hasEmail: sp.hasEmail === "1",
    search: sp.q || undefined,
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Leads" description={`${leads.length} lead${leads.length === 1 ? "" : "s"} for ${product?.name ?? "your selected product"}`} />
      <LeadsToolbar
        territories={territories.map((t) => ({ id: t.id, town: t.town }))}
        activeTerritoryId={active?.id ?? null}
      />

      {leads.length === 0 ? (
        <EmptyState
          icon={<Users className="h-8 w-8" />}
          title="No leads match"
          description="Run a search on Find Leads, add one manually, or adjust the filters above."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <Thead>
                <tr>
                  <Th>Business</Th>
                  <Th>Town</Th>
                  <Th>Email</Th>
                  <Th>Website</Th>
                  <Th className="text-right">Units</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Score</Th>
                  <Th>Found</Th>
                  <Th>Last contacted</Th>
                </tr>
              </Thead>
              <tbody>
                {leads.map((l) => (
                  <Tr key={l.id} className="cursor-pointer">
                    <Td>
                      <Link href={`/leads/${l.id}`} className="font-medium text-ink-strong hover:text-accent">
                        {l.businessName}
                      </Link>
                    </Td>
                    <Td className="text-muted">{l.town || "—"}</Td>
                    <Td>
                      {l.email ? (
                        <span className="flex items-center gap-1 text-muted">
                          <Mail className="h-3.5 w-3.5" /> {l.email}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </Td>
                    <Td>
                      {l.website ? (
                        <span className="flex items-center gap-1 text-muted">
                          <Globe className="h-3.5 w-3.5" /> {l.domain || l.website}
                        </span>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td className="text-right text-muted">{l.estimatedUnits ?? "—"}</Td>
                    <Td>
                      <LeadStatusBadge status={l.status} />
                    </Td>
                    <Td className="text-right font-medium">{l.leadScore}</Td>
                    <Td className="text-muted">{formatDate(l.createdAt)}</Td>
                    <Td className="text-muted">{formatDate(l.lastContactedAt)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
