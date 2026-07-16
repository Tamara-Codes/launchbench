"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label, Textarea } from "./ui";
import { saveTenantEmailTemplate } from "@/server/tenant-actions";

type Template = { language: string; sequence_step: "initial" | "first_follow_up" | "final_follow_up"; name: string; subject: string; body: string };
const steps: Array<{ value: Template["sequence_step"]; label: string }> = [{ value: "initial", label: "Initial email" }, { value: "first_follow_up", label: "First follow-up" }, { value: "final_follow_up", label: "Final follow-up" }];

export function TenantTemplateEditor({ productId, templates, language }: { productId: string; templates: Template[]; language: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Template["sequence_step"]>("initial");
  const existing = templates.find((template) => template.sequence_step === step && template.language === language);
  const [name, setName] = useState(existing?.name ?? "Initial outreach");
  const [subject, setSubject] = useState(existing?.subject ?? "");
  const [body, setBody] = useState(existing?.body ?? "");
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  function select(next: Template["sequence_step"]) { const found = templates.find((template) => template.sequence_step === next && template.language === language); setStep(next); setName(found?.name ?? steps.find((item) => item.value === next)?.label ?? "Template"); setSubject(found?.subject ?? ""); setBody(found?.body ?? ""); setMessage(""); }
  async function save() { setBusy(true); setMessage(""); const result = await saveTenantEmailTemplate({ productId, language, sequenceStep: step, name, subject, body }); setBusy(false); setMessage(result.ok ? "Saved." : result.error); if (result.ok) router.refresh(); }
  return <div className="space-y-4"><div className="flex flex-wrap gap-2">{steps.map((item) => <Button key={item.value} size="sm" variant={step === item.value ? "secondary" : "outline"} onClick={() => select(item.value)}>{item.label}</Button>)}</div><div className="grid gap-4"><div className="space-y-1.5"><Label>Template name</Label><Input value={name} onChange={(event) => setName(event.target.value)} /></div><div className="space-y-1.5"><Label>Subject</Label><Input value={subject} onChange={(event) => setSubject(event.target.value)} /></div><div className="space-y-1.5"><Label>Body</Label><p className="text-xs text-muted">Use variables such as {'{{business_name}}'}, {'{{town}}'}, and {'{{product_name}}'}.</p><Textarea rows={14} value={body} onChange={(event) => setBody(event.target.value)} /></div><div className="flex items-center gap-3"><Button disabled={busy || !subject.trim() || !body.trim()} onClick={save}>{busy ? "Saving…" : "Save template"}</Button>{message && <p className="text-sm text-muted" role="status">{message}</p>}</div></div></div>;
}
