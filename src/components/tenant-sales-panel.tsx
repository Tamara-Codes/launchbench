"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MapPin, Pencil, Sparkles, Target } from "lucide-react";
import { requestTenantJob } from "@/server/tenant-job-actions";
import { Button, Input, Label } from "./ui";
import { Select } from "./ui-select";

type CurrentProject = { id: string; name: string; targetCustomer: string } | null;
type Territory = { id: string; product_id: string; town: string; country: string };

export function TenantSalesPanel({ currentProject, territories }: { currentProject: CurrentProject; territories: Territory[] }) {
  const router = useRouter(); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);

  async function runSales(formData: FormData) {
    if (!currentProject) return;
    setBusy(true); setError("");
    const result = await requestTenantJob({ kind: "lead_search", productId: currentProject.id, input: { territoryId: String(formData.get("territoryId")), targetLeads: Number(formData.get("targetLeads") || 10), maxQueries: 8, maxCandidates: 40, maxPagesPerCandidate: 3 } });
    setBusy(false); if (!result.ok) setError(result.error); else router.refresh();
  }

  if (!currentProject) return <div className="rounded-2xl border border-dashed p-10 text-center"><p className="text-sm font-medium text-ink">No project selected</p><p className="mt-1 text-sm text-muted">Create a project to start finding leads for it.</p><Link href="/app/products/new" className="mt-4 inline-block text-sm font-semibold text-accent hover:underline">Add your first project →</Link></div>;

  return <div className="mx-auto max-w-xl">
    {error && <p className="mb-4 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{error}</p>}
    <form action={runSales} className="rounded-2xl border bg-surface p-6 shadow-sm">
      <h2 className="font-semibold text-ink-strong">Run the Sales Agent</h2>
      <p className="mt-2 text-sm text-muted">The agent researches businesses in the chosen territory and saves evidence-backed leads for your review.</p>

      <div className="mt-5 space-y-4">
        <div className="rounded-xl border bg-surface2/60 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted"><Target className="h-3.5 w-3.5" />Targeting</span>
            <Link href={`/app/products/${currentProject.id}`} className="flex items-center gap-1 text-xs font-medium text-accent hover:underline"><Pencil className="h-3 w-3" />Edit</Link>
          </div>
          <p className="mt-1.5 text-sm text-ink">{currentProject.targetCustomer || "No ideal customer defined yet — the agent will infer it from the product description. Add one for sharper results."}</p>
        </div>

        {territories.length ? <>
          <div><Label htmlFor="territoryId">Territory</Label><Select id="territoryId" name="territoryId" required defaultValue=""><option value="" disabled>Select territory</option>{territories.map((t) => <option key={t.id} value={t.id}>{t.town}, {t.country}</option>)}</Select><p className="mt-1.5 text-xs text-muted"><Link href="/app/territories" className="text-accent hover:underline">Manage territories</Link></p></div>
          <div><Label htmlFor="targetLeads">How many qualified leads?</Label><Input id="targetLeads" name="targetLeads" type="number" min="1" max="50" defaultValue="10" required /></div>
          <Button disabled={busy} className="flex w-full items-center justify-center gap-2">{busy ? "Queueing…" : <><Sparkles className="h-4 w-4" />Queue Sales Agent</>}</Button>
        </> : <div className="rounded-xl border border-dashed p-6 text-center"><MapPin className="mx-auto h-6 w-6 text-muted" /><p className="mt-2 text-sm font-medium text-ink">No territories yet</p><p className="mt-1 text-sm text-muted">Add a place for the agent to search before running it.</p><Link href="/app/territories" className="mt-3 inline-block text-sm font-semibold text-accent hover:underline">Add a territory →</Link></div>}
      </div>
    </form>
  </div>;
}
