"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "./ui";
import { requestTenantJobCancellation } from "@/server/tenant-job-actions";

type Job = { id: string; kind: string; status: string; attempt_count: number; error: string; created_at: string };

export function TenantJobList({ jobs }: { jobs: Job[] }) {
  const router = useRouter(); const [busyId, setBusyId] = useState(""); const [error, setError] = useState("");
  async function cancel(id: string) { setBusyId(id); setError(""); const result = await requestTenantJobCancellation(id); setBusyId(""); if (!result.ok) setError(result.error); else router.refresh(); }
  return <div className="space-y-3">{error && <p className="text-sm text-danger" role="alert">{error}</p>}{jobs.map((job) => <article key={job.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"><div><p className="font-medium text-ink-strong">{job.kind.replaceAll("_", " ")}</p><p className="mt-1 text-sm text-muted">{job.status} · attempt {job.attempt_count} · {new Date(job.created_at).toLocaleString()}</p>{job.error && <p className="mt-1 text-sm text-danger">{job.error}</p>}</div>{(job.status === "queued" || job.status === "running") && <Button size="sm" variant="outline" disabled={busyId === job.id} onClick={() => cancel(job.id)}>{busyId === job.id ? "Cancelling…" : "Cancel"}</Button>}</article>)}{!jobs.length && <p className="text-muted">No agent jobs yet.</p>}</div>;
}
