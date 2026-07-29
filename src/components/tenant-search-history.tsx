"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Table, Td, Th, Thead, Tr } from "./ui";
import { requestTenantJobCancellation } from "@/server/tenant-job-actions";

export type SalesRun = { id: string; jobId: string | null; project: string; territory: string; stage: string; status: string; error: string; created_at: string };

const ACTIVE = new Set(["queued", "running"]);

export function TenantSearchHistory({ runs }: { runs: SalesRun[] }) {
  const router = useRouter(); const [busyId, setBusyId] = useState(""); const [error, setError] = useState("");
  async function cancel(jobId: string) { setBusyId(jobId); setError(""); const result = await requestTenantJobCancellation(jobId); setBusyId(""); if (!result.ok) setError(result.error); else router.refresh(); }

  if (!runs.length) return <p className="rounded-2xl border p-5 text-sm text-muted">No Sales Agent runs have been recorded yet.</p>;

  return <div className="space-y-3">
    {error && <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{error}</p>}
    <div className="overflow-hidden rounded-2xl border"><Table><Thead><Tr><Th>Project</Th><Th>Territory</Th><Th>Stage</Th><Th>Status</Th><Th>Started</Th><Th> </Th></Tr></Thead><tbody>{runs.map((run) => <Tr key={run.id}>
      <Td className="font-medium text-ink-strong">{run.project}</Td>
      <Td>{run.territory}</Td>
      <Td>{run.stage}</Td>
      <Td>{run.error || run.status}</Td>
      <Td>{new Date(run.created_at).toLocaleDateString()}</Td>
      <Td>{ACTIVE.has(run.status) && run.jobId ? <Button size="sm" variant="outline" disabled={busyId === run.jobId} onClick={() => cancel(run.jobId!)}>{busyId === run.jobId ? "Cancelling…" : "Cancel"}</Button> : null}</Td>
    </Tr>)}</tbody></Table></div>
  </div>;
}
