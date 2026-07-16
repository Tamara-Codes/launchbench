import Link from "next/link";
import { History } from "lucide-react";
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
import { RunStatusBadge } from "@/components/status";
import { listRuns } from "@/server/repo";
import { formatDate, formatDuration } from "@/lib/utils";
import { getSelectedProduct } from "@/server/product-context";

export const dynamic = "force-dynamic";

export default async function SearchHistoryPage() {
  const product = await getSelectedProduct();
  const runs = await listRuns(100, product?.id);
  return (
    <div className="space-y-6">
      <PageHeader title="Search History" description={`Lead-search runs for ${product?.name ?? "your selected product"}.`} />
      {runs.length === 0 ? (
        <EmptyState icon={<History className="h-8 w-8" />} title="No search runs yet" description="Start one on Find Leads." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <Thead>
                <tr>
                  <Th>Territory</Th>
                  <Th>Started</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Queries</Th>
                  <Th className="text-right">Candidates</Th>
                  <Th className="text-right">Duplicates</Th>
                  <Th className="text-right">Qualified</Th>
                  <Th className="text-right">Duration</Th>
                </tr>
              </Thead>
              <tbody>
                {runs.map(({ run, town }) => {
                  const dur =
                    run.startedAt && run.completedAt
                      ? formatDuration(new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime())
                      : "—";
                  return (
                    <Tr key={run.id}>
                      <Td>
                        <Link href={`/search-history/${run.id}`} className="font-medium text-ink-strong hover:text-accent">
                          {town ?? "—"}
                        </Link>
                      </Td>
                      <Td className="text-muted">{formatDate(run.createdAt, true)}</Td>
                      <Td>
                        <RunStatusBadge status={run.status} />
                      </Td>
                      <Td className="text-right">{run.stats.queriesCompleted}</Td>
                      <Td className="text-right">{run.stats.candidatesDiscovered}</Td>
                      <Td className="text-right">{run.stats.duplicatesFound}</Td>
                      <Td className="text-right font-medium">{run.stats.qualifiedLeads}</Td>
                      <Td className="text-right text-muted">{dur}</Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
