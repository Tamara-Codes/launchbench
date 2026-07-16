import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, PageHeader } from "@/components/ui";
import { RunStatusBadge } from "@/components/status";
import { getRun, getRunCandidateBreakdown, getRunEvents, getTerritory } from "@/server/repo";
import { formatDate, formatDuration } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await getRun(id);
  if (!run) notFound();
  const [territory, events, breakdown] = await Promise.all([
    getTerritory(run.territoryId),
    getRunEvents(id, 300),
    getRunCandidateBreakdown(id),
  ]);
  const s = run.stats;

  const funnel = [
    { label: "Search results (candidates)", value: s.candidatesDiscovered },
    { label: "Unique (not pre-rejected)", value: s.candidatesDiscovered - s.candidatesRejectedPreScrape },
    { label: "Scraped", value: s.candidatesScraped },
    { label: "Qualified leads", value: s.qualifiedLeads },
  ];
  const top = Math.max(...funnel.map((f) => f.value), 1);
  const dur =
    run.startedAt && run.completedAt
      ? formatDuration(new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime())
      : "—";

  return (
    <div className="space-y-6">
      <Link href="/search-history" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Back to history
      </Link>
      <PageHeader
        title={`Run · ${territory?.town ?? ""}`}
        description={`${formatDate(run.createdAt, true)} · ${dur}`}
        actions={<RunStatusBadge status={run.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Funnel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {funnel.map((f, i) => {
              const prev = i > 0 ? funnel[i - 1]!.value : f.value;
              const pctOfTop = (f.value / top) * 100;
              const conv = prev > 0 ? Math.round((f.value / prev) * 100) : 0;
              return (
                <div key={f.label}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted">{f.label}</span>
                    <span className="font-medium text-ink-strong">
                      {f.value}
                      {i > 0 && <span className="ml-2 text-xs text-muted">{conv}%</span>}
                    </span>
                  </div>
                  <div className="mt-1 h-3 w-full overflow-hidden rounded bg-surface2">
                    <div className="h-full rounded bg-accent" style={{ width: `${pctOfTop}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Run stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <Row label="Target leads" value={run.config.targetLeads} />
            <Row label="Queries used" value={s.queriesCompleted} />
            <Row label="Candidates discovered" value={s.candidatesDiscovered} />
            <Row label="Rejected pre-scrape" value={s.candidatesRejectedPreScrape} />
            <Row label="Scraped" value={s.candidatesScraped} />
            <Row label="Duplicates" value={s.duplicatesFound} />
            <Row label="Qualified" value={s.qualifiedLeads} />
            <Row label="Manual review" value={s.manualReviewCandidates} />
            <Row label="Rejected" value={breakdown.rejected ?? 0} />
            <Row label="Errors" value={s.errors} />
            <Row label="Firecrawl searches" value={s.firecrawlSearchCalls} />
            <Row label="Firecrawl scrapes" value={s.firecrawlScrapeCalls} />
            <Row label="Gemini calls" value={s.geminiCalls} />
            <Row label="Gemini tokens" value={s.geminiPromptTokens + s.geminiOutputTokens} />
          </CardContent>
        </Card>
      </div>

      {(run.exhaustionSignal || run.errorMessage) && (
        <Card>
          <CardContent className="pt-5 text-sm">
            {run.exhaustionSignal && <p className="text-warning">Exhaustion signal: {run.exhaustionSignal}</p>}
            {run.errorMessage && <p className="text-danger">Error: {run.errorMessage}</p>}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Event log ({events.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-96 space-y-1 overflow-y-auto rounded-lg border bg-surface2/40 p-3 font-mono text-xs">
            {events.length === 0 ? (
              <p className="text-muted">No events recorded.</p>
            ) : (
              events
                .slice()
                .reverse()
                .map((e) => (
                  <div key={e.id} className="flex gap-2">
                    <span className="shrink-0 text-muted">{new Date(e.createdAt).toLocaleTimeString()}</span>
                    <span className="text-ink">{e.message}</span>
                  </div>
                ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b py-1.5 last:border-0">
      <span className="text-muted">{label}</span>
      <span className="font-medium text-ink-strong">{value}</span>
    </div>
  );
}
