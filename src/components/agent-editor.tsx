"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, RotateCcw, Eye, History, Loader2, Power } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Textarea } from "./ui";
import { toast } from "./toast";
import {
  previewPrompt,
  restoreAgentVersion,
  restoreDefaultPrompt,
  toggleAgent,
  updateAgentPrompt,
} from "@/server/actions";
import { formatDate } from "@/lib/utils";

interface Version {
  id: string;
  version: number;
  note: string;
  createdAt: string;
}

interface Props {
  slug: string;
  initial: {
    systemPrompt: string;
    taskPromptTemplate: string;
    model: string;
    temperature: number;
    enabled: boolean;
    textProvider: "gemini";
    imageProvider?: "gemini";
    imageModel?: string;
  };
  versions: Version[];
}

export function AgentEditor({ slug, initial, versions }: Props) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [showVersions, setShowVersions] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    setBusy(true);
    const res = await updateAgentPrompt(slug, { ...form, note });
    setBusy(false);
    if (res.ok) {
      toast(`Saved as version ${res.data?.version}.`, "success");
      setNote("");
      router.refresh();
    } else toast(res.error, "error");
  }

  async function doPreview() {
    const res = await previewPrompt(form.taskPromptTemplate);
    if (res.ok) setPreview(res.data?.rendered ?? "");
    else toast(res.error, "error");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>System prompt</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              rows={16}
              value={form.systemPrompt}
              onChange={(e) => set("systemPrompt", e.target.value)}
              className="font-mono text-xs"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Task prompt template</CardTitle>
              <Button size="sm" variant="outline" onClick={doPreview}>
                <Eye className="h-4 w-4" /> Preview
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              rows={12}
              value={form.taskPromptTemplate}
              onChange={(e) => set("taskPromptTemplate", e.target.value)}
              className="font-mono text-xs"
            />
            {preview !== null && (
              <div className="rounded-lg border bg-surface2/40 p-3">
                <p className="mb-1 text-xs font-semibold uppercase text-muted">Rendered with sample variables</p>
                <pre className="prose-evidence whitespace-pre-wrap text-xs text-ink">{preview}</pre>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Agent controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted">Quality and model choices are managed by the app, so you can focus on the agent's instructions and results.</p>
            <div className="space-y-1.5">
              <Label>Temperature ({form.temperature.toFixed(2)})</Label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={form.temperature}
                onChange={(e) => set("temperature", Number(e.target.value))}
                className="w-full accent-[var(--accent)]"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-sm text-ink">Agent enabled</span>
              <Button
                size="sm"
                variant={form.enabled ? "success" : "secondary"}
                onClick={async () => {
                  const next = !form.enabled;
                  set("enabled", next);
                  await toggleAgent(slug, next);
                  toast(next ? "Agent enabled." : "Agent disabled.", "success");
                  router.refresh();
                }}
              >
                <Power className="h-4 w-4" /> {form.enabled ? "On" : "Off"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Save changes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Input placeholder="Version note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
            <Button className="w-full" onClick={save} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save as new version
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={async () => {
                if (!window.confirm("Restore the default prompt? This creates a new version.")) return;
                const res = await restoreDefaultPrompt(slug);
                if (res.ok) {
                  toast("Default restored.", "success");
                  router.refresh();
                } else toast(res.error, "error");
              }}
            >
              <RotateCcw className="h-4 w-4" /> Restore default
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <History className="h-4 w-4" /> Version history
              </CardTitle>
              <Button size="sm" variant="ghost" onClick={() => setShowVersions((s) => !s)}>
                {showVersions ? "Hide" : "Show"}
              </Button>
            </div>
          </CardHeader>
          {showVersions && (
            <CardContent className="space-y-2">
              {versions.map((v) => (
                <div key={v.id} className="flex items-center justify-between border-b py-1.5 text-sm last:border-0">
                  <div>
                    <p className="font-medium text-ink">v{v.version}</p>
                    <p className="text-xs text-muted">
                      {v.note || "—"} · {formatDate(v.createdAt)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      const res = await restoreAgentVersion(slug, v.id);
                      if (res.ok) {
                        toast(`Restored v${v.version}.`, "success");
                        router.refresh();
                      } else toast(res.error, "error");
                    }}
                  >
                    Restore
                  </Button>
                </div>
              ))}
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
