"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, X, CircleDashed } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Progress } from "./ui";
import { RunStatusBadge } from "./status";
import { cancelRun, resumeRunAction } from "@/server/actions";
import { toast } from "./toast";
import { cn, formatDuration } from "@/lib/utils";

const STAGES = ["planning", "searching", "deduplicating", "enriching", "qualifying", "completed"] as const;
const STAGE_LABELS: Record<string, string> = {
  planning: "Planning",
  searching: "Searching",
  deduplicating: "Deduplicating",
  enriching: "Enriching",
  qualifying: "Qualifying",
  generatingDrafts: "Drafts",
  completed: "Complete",
};
const TERMINAL = ["completed", "completedPartial", "failed", "cancelled"];

interface RunData {
  run: any;
  events: { id: string; message: string; stage: string; createdAt: string }[];
  breakdown: Record<string, number>;
  runningInProcess?: boolean;
}

export function RunProgress({ runId, onDone }: { runId: string; onDone?: () => void }) {
  const [data, setData] = useState<RunData | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const router = useRouter();
  const doneRef = useRef(false);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const res = await fetch(`/api/runs/${runId}`, { cache: "no-store" });
        if (res.ok && active) {
          const json = (await res.json()) as RunData;
          setData(json);
          if (TERMINAL.includes(json.run.status)) {
            if (!doneRef.current) {
              doneRef.current = true;
              router.refresh();
              onDone?.();
            }
            return; // stop polling
          }
        }
      } catch {
        /* transient; keep polling */
      }
      if (active) timer = setTimeout(poll, 1500);
    }
    poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [runId, router, onDone]);

  if (!data) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-10 text-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading run…
        </CardContent>
      </Card>
    );
  }

  const { run, events, breakdown } = data;
  const stats = run.stats;
  const currentStageIndex = STAGES.indexOf(run.stage);
  const isTerminal = TERMINAL.includes(run.status);
  const started = run.startedAt ? new Date(run.startedAt).getTime() : Date.now();
  const end = run.completedAt ? new Date(run.completedAt).getTime() : Date.now();
  const elapsed = formatDuration(end - started);
  const target = run.config.targetLeads;
  const pct = (stats.qualifiedLeads / target) * 100;
  // Stall detection: active status but no event for >25s (e.g. app was restarted).
  const lastEvent = run.lastEventAt ? new Date(run.lastEventAt).getTime() : started;
  const stalled = !isTerminal && !data.runningInProcess && Date.now() - lastEvent > 25000;

  async function doCancel() {
    setCancelling(true);
    const res = await cancelRun(runId);
    if (res.ok) toast("Cancellation requested — will stop after the current candidate.", "info");
    else toast(res.error, "error");
    setCancelling(false);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Search run</CardTitle>
          <div className="flex items-center gap-3">
            <RunStatusBadge status={run.status} />
            <span className="text-xs text-muted">Elapsed {elapsed}</span>
            {!isTerminal && (
              <Button size="sm" variant="danger" onClick={doCancel} disabled={cancelling}>
                {cancelling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                Cancel
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Stage tracker */}
        <div className="flex flex-wrap items-center gap-1.5">
          {STAGES.map((stage, i) => {
            const done = isTerminal ? stage !== "completed" || run.status === "completed" : i < currentStageIndex;
            const active = !isTerminal && i === currentStageIndex;
            const complete = isTerminal && (run.status === "completed" || run.status === "completedPartial");
            const isDone = done || (stage === "completed" && complete);
            return (
              <div key={stage} className="flex items-center gap-1.5">
                <div
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                    active && "bg-accent-soft text-accent",
                    isDone && !active && "bg-success-soft text-success",
                    !active && !isDone && "bg-surface2 text-muted",
                  )}
                >
                  {active ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : isDone ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <CircleDashed className="h-3 w-3" />
                  )}
                  {STAGE_LABELS[stage]}
                </div>
                {i < STAGES.length - 1 && <span className="text-muted">·</span>}
              </div>
            );
          })}
        </div>

        {/* Target progress */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-muted">
              {run.currentCandidate ? `Processing: ${run.currentCandidate}` : "Qualified leads"}
            </span>
            <span className="font-medium text-ink-strong">
              {stats.qualifiedLeads} of {target}
            </span>
          </div>
          <Progress value={pct} />
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Queries" value={stats.queriesCompleted} />
          <Stat label="Candidates" value={stats.candidatesDiscovered} />
          <Stat label="Scraped" value={stats.candidatesScraped} />
          <Stat label="Duplicates" value={stats.duplicatesFound} />
          <Stat label="Qualified" value={stats.qualifiedLeads} tone="success" />
          <Stat label="Review" value={stats.manualReviewCandidates} />
          <Stat label="Rejected" value={breakdown.rejected ?? 0} />
          <Stat label="Errors" value={stats.errors} tone={stats.errors ? "danger" : undefined} />
        </div>

        {stalled && (
          <div className="flex flex-col items-start justify-between gap-2 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning sm:flex-row sm:items-center">
            <span>This run appears interrupted (the app may have restarted). Resume to continue from stored progress.</span>
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                const res = await resumeRunAction(runId);
                if (res.ok) toast("Resuming run…", "info");
                else toast(res.error, "error");
              }}
            >
              Resume
            </Button>
          </div>
        )}

        {run.exhaustionSignal && (
          <p className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">{run.exhaustionSignal}</p>
        )}
        {run.errorMessage && (
          <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{run.errorMessage}</p>
        )}

        {/* Live event log */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Live log</p>
          <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border bg-surface2/40 p-3 font-mono text-xs">
            {events.length === 0 ? (
              <p className="text-muted">Waiting for events…</p>
            ) : (
              events.map((e) => (
                <div key={e.id} className="flex gap-2">
                  <span className="shrink-0 text-muted">{new Date(e.createdAt).toLocaleTimeString()}</span>
                  <span className="text-ink">{e.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "success" | "danger" }) {
  return (
    <div className="rounded-lg border bg-surface p-2.5">
      <div
        className={cn(
          "text-lg font-semibold text-ink-strong",
          tone === "success" && "text-success",
          tone === "danger" && "text-danger",
        )}
      >
        {value}
      </div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}
