"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Play, RotateCcw, Loader2 } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Textarea,
} from "./ui";
import { Select } from "./ui-select";
import { RunProgress } from "./run-progress";
import { toast } from "./toast";
import {
  activateTerritory,
  createTerritory,
  resumeRunAction,
  startRun,
} from "@/server/actions";
import { DEFAULT_TARGET_CATEGORIES } from "@/agents/lead-finder/prompts";

interface Territory {
  id: string;
  town: string;
  country: string;
  active: boolean;
  possiblyExhausted: boolean;
  confirmedExhausted: boolean;
}

interface Props {
  territories: Territory[];
  activeTerritoryId: string | null;
  agentId: string;
  agentEnabled: boolean;
  productId: string;
  existingActiveRunId: string | null;
  resumableRunId: string | null;
}

export function FindLeadsClient({
  territories,
  activeTerritoryId,
  agentId,
  agentEnabled,
  productId,
  existingActiveRunId,
  resumableRunId,
}: Props) {
  const router = useRouter();
  const [runId, setRunId] = useState<string | null>(existingActiveRunId);
  const [territoryId, setTerritoryId] = useState(activeTerritoryId ?? territories[0]?.id ?? "");
  const [starting, setStarting] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const [targetLeads, setTargetLeads] = useState(10);
  const [categories, setCategories] = useState(DEFAULT_TARGET_CATEGORIES.join(", "));

  const selected = territories.find((t) => t.id === territoryId) ?? null;

  async function onStart() {
    if (!territoryId) return toast("Select a territory first.", "error");
    if (!agentEnabled) return toast("The lead-finder agent is disabled. Enable it on the Agents page.", "error");
    setStarting(true);
    // Make sure the chosen territory is the active one.
    if (territoryId !== activeTerritoryId) await activateTerritory(territoryId);
    const res = await startRun({
      territoryId,
      agentId,
      productId,
      targetLeads,
      targetCategories: categories.split(",").map((c) => c.trim()).filter(Boolean),
    });
    setStarting(false);
    if (res.ok && res.data) {
      setRunId(res.data.runId);
      toast("Search started.", "success");
    } else if (!res.ok) {
      toast(res.error, "error");
    }
  }

  return (
    <div className="space-y-6">
      {resumableRunId && !runId && (
        <Card>
          <CardContent className="flex flex-col items-start justify-between gap-3 pt-5 sm:flex-row sm:items-center">
            <div>
              <p className="font-medium text-ink-strong">An interrupted run was found</p>
              <p className="text-sm text-muted">Resume it to continue from stored progress, or start fresh.</p>
            </div>
            <Button
              variant="secondary"
              onClick={async () => {
                const res = await resumeRunAction(resumableRunId);
                if (res.ok) {
                  setRunId(resumableRunId);
                  toast("Resuming run…", "info");
                } else toast(res.error, "error");
              }}
            >
              <RotateCcw className="h-4 w-4" /> Resume run
            </Button>
          </CardContent>
        </Card>
      )}

      {runId ? (
        <RunProgress runId={runId} onDone={() => router.refresh()} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Territory selector */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Territory</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label>Selected town</Label>
                <Select value={territoryId} onChange={(e) => setTerritoryId(e.target.value)}>
                  {territories.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.town}, {t.country}
                    </option>
                  ))}
                </Select>
              </div>
              {selected && (
                <div className="space-y-2 rounded-lg bg-surface2/50 p-3 text-sm">
                  <div className="flex items-center gap-2">
                    {selected.confirmedExhausted ? (
                      <Badge tone="danger">Confirmed exhausted</Badge>
                    ) : selected.possiblyExhausted ? (
                      <Badge tone="warning">Possibly exhausted</Badge>
                    ) : (
                      <Badge tone="success">Ready</Badge>
                    )}
                    {selected.active && <Badge tone="accent">Active</Badge>}
                  </div>
                  <p className="text-sm text-muted">Search area: {selected.town}, {selected.country}</p>
                </div>
              )}
              <Button variant="outline" className="w-full" onClick={() => setShowCreate((s) => !s)}>
                <Plus className="h-4 w-4" /> Create territory
              </Button>
              {showCreate && <CreateTerritoryForm onCreated={(id) => { setTerritoryId(id); setShowCreate(false); router.refresh(); }} />}
            </CardContent>
          </Card>

          {/* Search settings */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Search settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-w-xs">
                <NumberField label="Target qualified leads" value={targetLeads} onChange={setTargetLeads} min={1} max={50} />
              </div>
              <div className="space-y-1.5">
                <Label>Target categories (comma-separated)</Label>
                <Textarea rows={2} value={categories} onChange={(e) => setCategories(e.target.value)} />
              </div>

              <div className="rounded-lg border bg-surface2/40 p-3 text-sm text-muted">
                <p className="font-medium text-ink">Before you start</p>
                <ul className="mt-1 list-inside list-disc space-y-0.5">
                  <li>Fewer than {targetLeads} leads may be returned — the quality threshold is never lowered to hit the number.</li>
                  <li>Previous searches and processed businesses are loaded first, so nothing is repeated.</li>
                </ul>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={onStart} disabled={starting || !territoryId}>
                  {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  Start Search
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || min)))}
      />
    </div>
  );
}

function CreateTerritoryForm({ onCreated }: { onCreated: (id: string) => void }) {
  const [town, setTown] = useState("");
  const [country, setCountry] = useState("Croatia");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!town.trim()) return toast("Town is required.", "error");
    setSaving(true);
    const res = await createTerritory({
      town: town.trim(),
      country: country.trim() || "Croatia",
      notes: "",
    });
    setSaving(false);
    if (res.ok && res.data) {
      toast("Territory created.", "success");
      onCreated(res.data.id);
    } else if (!res.ok) toast(res.error, "error");
  }

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <Input placeholder="Town (e.g. Baška)" value={town} onChange={(e) => setTown(e.target.value)} />
      <Input placeholder="Country" value={country} onChange={(e) => setCountry(e.target.value)} />
      <Button size="sm" className="w-full" onClick={submit} disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create
      </Button>
    </div>
  );
}
