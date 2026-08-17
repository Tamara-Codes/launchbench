import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card, CardContent, PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/server/tenant-context";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type JobEvent = { id: number; event_type: string; message: string; metadata: Record<string, unknown>; created_at: string };

export default async function SalesRunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await getTenantContext();
  if (!context) redirect("/onboarding");
  const supabase = await createClient();
  const { data: run } = await supabase
    .from("sales_runs")
    .select("id, job_id, status, stage, error, stats, exhaustion_signal, created_at, completed_at, territories(town, country), projects(name)")
    .eq("id", id)
    .eq("workspace_id", context.workspace.id)
    .maybeSingle();
  if (!run) notFound();

  const { data: events } = run.job_id
    ? await supabase.from("agent_job_events").select("id, event_type, message, metadata, created_at").eq("job_id", run.job_id).eq("workspace_id", context.workspace.id).order("created_at", { ascending: true })
    : { data: [] as JobEvent[] };

  const territory = run.territories as { town?: string; country?: string } | null;
  const project = (run.projects as { name?: string } | null)?.name ?? "—";

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <Link className="text-sm text-accent" href="/app/search-history">← Search History</Link>
      <div className="mt-5">
        <PageHeader
          title={`${project} · ${territory?.town ?? "—"}${territory?.country ? ", " + territory.country : ""}`}
          description={`${run.status}${run.stage ? " · " + run.stage : ""} — started ${new Date(run.created_at).toLocaleString("en-GB")}`}
        />
      </div>

      {run.error && <p className="mt-4 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{run.error}</p>}
      {run.exhaustion_signal && <p className="mt-4 rounded-lg border border-border bg-surface2 px-3 py-2 text-sm text-muted">{run.exhaustion_signal}</p>}

      {run.stats && (
        <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted">
          {Object.entries(run.stats as Record<string, number>).map(([key, value]) => (
            <span key={key} className="rounded-full border border-border px-2.5 py-1">{key}: <span className="font-semibold text-ink-strong">{value}</span></span>
          ))}
        </div>
      )}

      <div className="mt-6 space-y-2">
        {!events?.length && <p className="rounded-2xl border p-5 text-sm text-muted">No log events recorded for this run yet.</p>}
        {(events ?? []).map((event) => <JobEventRow key={event.id} event={event as JobEvent} />)}
      </div>
    </main>
  );
}

function JobEventRow({ event }: { event: JobEvent }) {
  const isError = event.event_type === "failed" || event.metadata?.level === "error";
  const metadataEntries = Object.entries(event.metadata ?? {}).filter(([key]) => key !== "level");

  return (
    <Card className={cn(isError && "border-danger/40")}>
      <CardContent className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <p className={cn("text-sm", isError ? "text-danger" : "text-ink")}>{event.message}</p>
          <span className="shrink-0 text-xs text-muted">{new Date(event.created_at).toLocaleTimeString("en-GB")}</span>
        </div>
        {metadataEntries.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-border bg-surface2 p-2">
            <pre className="whitespace-pre-wrap break-words text-xs text-muted">{JSON.stringify(Object.fromEntries(metadataEntries), null, 2)}</pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
