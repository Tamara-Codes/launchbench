"use client";

import { useState } from "react";
import { Button, Input, Label, Textarea } from "./ui";
import { updateTenantWorkspaceSettings } from "@/server/tenant-actions";

export function TenantWorkspaceSettingsForm({ settings }: { settings: { sender_name: string; sender_company: string; sender_email: string; sender_signature: string; daily_lead_target: number } }) {
  const [form, setForm] = useState({ senderName: settings.sender_name, senderCompany: settings.sender_company, senderEmail: settings.sender_email, senderSignature: settings.sender_signature, dailyLeadTarget: settings.daily_lead_target });
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  const set = (key: keyof typeof form, value: string | number) => setForm((current) => ({ ...current, [key]: value }));
  async function save() { setBusy(true); setMessage(""); const result = await updateTenantWorkspaceSettings(form); setBusy(false); setMessage(result.ok ? "Saved." : result.error); }
  return <div className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><Field label="Sender name" value={form.senderName} onChange={(value) => set("senderName", value)} /><Field label="Company or brand" value={form.senderCompany} onChange={(value) => set("senderCompany", value)} /><Field label="Default sending email" value={form.senderEmail} onChange={(value) => set("senderEmail", value)} type="email" /><div className="space-y-1.5"><Label>Daily lead target</Label><Input type="number" min={1} max={100} value={form.dailyLeadTarget} onChange={(event) => set("dailyLeadTarget", Number(event.target.value) || 1)} /></div></div><div className="space-y-1.5"><Label>Default signature</Label><Textarea rows={5} value={form.senderSignature} onChange={(event) => set("senderSignature", event.target.value)} /></div><div className="flex items-center gap-3"><Button disabled={busy} onClick={save}>{busy ? "Saving…" : "Save sender profile"}</Button>{message && <p className="text-sm text-muted" role="status">{message}</p>}</div></div>;
}
function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) { return <div className="space-y-1.5"><Label>{label}</Label><Input type={type} value={value} onChange={(event) => onChange(event.target.value)} /></div>; }
