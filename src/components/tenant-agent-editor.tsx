"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Textarea } from "./ui";
import { saveTenantAgent } from "@/server/tenant-agent-actions";
import { AgentAvatar, agentAvatarColors, agentAvatarSwatchClasses, type AgentAvatarColor } from "./agent-avatar";

export function TenantAgentEditor({ agent }: { agent: { slug: string; name: string; system_prompt: string; avatar_color: string } }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: agent.name, systemPrompt: agent.system_prompt, avatarColor: agent.avatar_color as AgentAvatarColor });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    setBusy(true);
    const result = await saveTenantAgent(agent.slug, form);
    setBusy(false);
    setMessage(result.ok ? "Changes saved." : result.error);
    if (result.ok) router.refresh();
  }

  return <div className="grid gap-6 lg:grid-cols-3"><Card className="lg:col-span-2"><CardHeader><CardTitle>System prompt</CardTitle></CardHeader><CardContent><Textarea rows={16} className="font-mono text-xs" value={form.systemPrompt} onChange={(event) => setForm((current) => ({ ...current, systemPrompt: event.target.value }))} /></CardContent></Card><div className="space-y-6"><Card><CardHeader><CardTitle>Agent identity</CardTitle></CardHeader><CardContent className="space-y-5"><div className="flex items-center gap-3"><AgentAvatar name={form.name} color={form.avatarColor} /><div><p className="font-medium text-ink-strong">{form.name || "Agent"}</p><p className="text-sm text-muted">Preview</p></div></div><div className="space-y-1.5"><Label>Name</Label><Input value={form.name} maxLength={120} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></div><div className="space-y-2"><Label>Avatar color</Label><div className="flex flex-wrap gap-2">{agentAvatarColors.map((color) => <button key={color} type="button" aria-label={`Use ${color} avatar color`} aria-pressed={form.avatarColor === color} onClick={() => setForm((current) => ({ ...current, avatarColor: color }))} className={`h-8 w-8 rounded-full ${agentAvatarSwatchClasses[color]} ${form.avatarColor === color ? "ring-2 ring-offset-2 ring-offset-surface ring-ink-strong" : "opacity-60 hover:opacity-100"}`} />)}</div></div></CardContent></Card><Card><CardHeader><CardTitle>Save changes</CardTitle></CardHeader><CardContent className="space-y-3"><Button className="w-full" disabled={busy} onClick={save}><Save className="h-4 w-4" />{busy ? "Saving…" : "Save changes"}</Button>{message && <p className="text-sm text-muted">{message}</p>}</CardContent></Card></div></div>;
}
