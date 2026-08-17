"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MapPin, Sparkles } from "lucide-react";
import { requestTenantJob } from "@/server/tenant-job-actions";
import { setCurrentProject } from "@/server/current-project-actions";
import { Button, Input, Label } from "./ui";
import { Select } from "./ui-select";
type CurrentProject = { id: string; name: string; targetCustomer: string } | null;
type Project = { id: string; name: string; active: boolean };
type Territory = { id: string; project_id: string; town: string; country: string };
export function TenantSalesPanel({ currentProject, projects, territories, agentName }: { currentProject: CurrentProject; projects: Project[]; territories: Territory[]; agentName: string }) {
  const router = useRouter(); const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [switching, setSwitching] = useState(false);
  async function selectProject(projectId: string) { if (!projectId || projectId === currentProject?.id) return; setSwitching(true); await setCurrentProject(projectId); router.refresh(); setSwitching(false); }
  async function runSales(formData: FormData) { if (!currentProject) return; setBusy(true); setError(""); const result = await requestTenantJob({ kind: "lead_search", projectId: currentProject.id, input: { territoryId: String(formData.get("territoryId")), targetLeads: Number(formData.get("targetLeads") || 10), maxQueries: 8, maxCandidates: 40, maxPagesPerCandidate: 3 } }); setBusy(false); if (!result.ok) setError(result.error); else router.refresh(); }
  return <div className="mx-auto max-w-3xl">
    {error && <p className="mb-4 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{error}</p>}
    <form action={runSales} className="rounded-2xl border bg-surface p-6 shadow-sm sm:p-8">
      <h2 className="font-semibold text-ink-strong">Run {agentName}</h2>
      <p className="mt-2 text-sm text-muted">Choose what you are selling, then pick where Sally should find leads.</p>
      <div className="mt-5 space-y-4">
        <div><Label htmlFor="projectId">Project</Label><Select id="projectId" name="projectId" value={currentProject?.id ?? ""} onChange={(event) => void selectProject(event.target.value)} disabled={switching || !projects.length}><option value="" disabled>{projects.length ? "Select project" : "No projects yet"}</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</Select><p className="mt-1.5 text-xs text-muted">{switching ? "Switching project…" : <Link href="/app/projects" className="text-accent hover:underline">Manage projects</Link>}</p></div>
        {currentProject ? <>{territories.length ? <><div><Label htmlFor="territoryId">Territory</Label><Select id="territoryId" name="territoryId" required defaultValue=""><option value="" disabled>Select territory</option>{territories.map((t) => <option key={t.id} value={t.id}>{t.town}, {t.country}</option>)}</Select><p className="mt-1.5 text-xs text-muted"><Link href="/app/territories" className="text-accent hover:underline">Manage territories</Link></p></div><div><Label htmlFor="targetLeads">How many qualified leads?</Label><Input id="targetLeads" name="targetLeads" type="number" min="1" max="50" defaultValue="10" required /></div><Button disabled={busy} className="flex w-full items-center justify-center gap-2">{busy ? <>Starting {agentName}…</> : <><Sparkles className="h-4 w-4" />Run {agentName}</>}</Button></> : <div className="rounded-xl border border-dashed p-6 text-center"><MapPin className="mx-auto h-6 w-6 text-muted" /><p className="mt-2 text-sm font-medium text-ink">No territories yet</p><p className="mt-1 text-sm text-muted">Add a place for the agent to search before running it.</p><Link href="/app/territories" className="mt-3 inline-block text-sm font-semibold text-accent hover:underline">Add a territory →</Link></div>}</> : <div className="rounded-xl border border-dashed p-6 text-center"><p className="text-sm font-medium text-ink">No project selected</p><p className="mt-1 text-sm text-muted">Choose a project above before running Sally.</p></div>}
      </div>
    </form>
  </div>;
}
