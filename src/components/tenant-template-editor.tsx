"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label, Textarea } from "./ui";
import { Select } from "./ui-select";
import { generateTenantEmailTemplateDrafts, saveTenantEmailTemplate } from "@/server/tenant-actions";
import { EMAIL_SEQUENCE_STEPS, type EmailSequenceStep } from "@/agents/lead-finder/email-templates";
import { cn } from "@/lib/utils";

type Step = EmailSequenceStep;
type Template = { language: string; sequence_step: Step; name: string; subject: string; body: string };
type Draft = { name: string; subject: string; body: string };

const steps = EMAIL_SEQUENCE_STEPS;
const stepName = (value: Step) => steps.find((item) => item.value === value)?.label ?? "Template";

const LANGUAGES = [
  { value: "hr", label: "Croatian" },
  { value: "en", label: "English" },
  { value: "de", label: "German" },
  { value: "it", label: "Italian" },
];

export function TenantTemplateEditor({ projectId, templates, language: defaultLanguage }: { projectId: string; templates: Template[]; language: string }) {
  const router = useRouter();
  const [language, setLanguage] = useState(defaultLanguage);
  const [step, setStep] = useState<Step>("initial");

  // Freshly-generated drafts, keyed by step, not yet saved — take priority
  // over the saved `templates` prop until the user saves or the language
  // changes (a draft in one language shouldn't silently appear under another).
  const [drafts, setDrafts] = useState<Partial<Record<Step, Draft>>>({});

  const saved = templates.find((template) => template.sequence_step === step && template.language === language);
  const active = drafts[step] ?? saved ?? null;
  const [subject, setSubject] = useState(active?.subject ?? "");
  const [body, setBody] = useState(active?.body ?? "");
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState("");
  // Which steps to draft on the next "Generate with AI" — defaults to all
  // three, but she doesn't always want a full sequence.
  const [stepsToGenerate, setStepsToGenerate] = useState<Step[]>(steps.map((item) => item.value));

  function toggleStepToGenerate(value: Step) {
    setStepsToGenerate((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]));
  }

  function loadStep(nextStep: Step, nextLanguage: string, nextDrafts: Partial<Record<Step, Draft>>) {
    const draft = nextDrafts[nextStep];
    const savedTemplate = templates.find((template) => template.sequence_step === nextStep && template.language === nextLanguage);
    const source = draft ?? savedTemplate ?? null;
    setSubject(source?.subject ?? "");
    setBody(source?.body ?? "");
  }

  function selectStep(next: Step) {
    setStep(next);
    setMessage("");
    loadStep(next, language, drafts);
  }

  function selectLanguage(next: string) {
    setLanguage(next);
    setDrafts({});
    setMessage("");
    loadStep(step, next, {});
  }

  async function generate() {
    if (!stepsToGenerate.length) return;
    setGenerating(true);
    setMessage("");
    const result = await generateTenantEmailTemplateDrafts({ projectId, language, steps: stepsToGenerate });
    setGenerating(false);
    if (!result.ok || !result.data) { setMessage(!result.ok ? result.error : "No draft returned."); return; }
    const merged = { ...drafts, ...result.data };
    setDrafts(merged);
    loadStep(step, language, merged);
    setMessage(stepsToGenerate.length === steps.length ? "Drafted — review and edit before saving." : "Drafted the selected steps — review and edit before saving.");
  }

  async function save() {
    setBusy(true);
    setMessage("");
    const result = await saveTenantEmailTemplate({ projectId, language, sequenceStep: step, name: stepName(step), subject, body });
    setBusy(false);
    setMessage(result.ok ? "Saved." : result.error);
    if (result.ok) {
      setDrafts((current) => { const next = { ...current }; delete next[step]; return next; });
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-lg border border-border bg-surface2/50 p-3">
        <p className="text-xs font-medium text-ink">Which emails do you want?</p>
        <div className="flex flex-wrap gap-2">
          {steps.map((item) => (
            <label
              key={item.value}
              className={cn(
                "flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
                stepsToGenerate.includes(item.value) ? "border-accent bg-accent-soft text-accent" : "border-border text-muted hover:text-ink",
              )}
            >
              <input
                type="checkbox"
                checked={stepsToGenerate.includes(item.value)}
                onChange={() => toggleStepToGenerate(item.value)}
                className="h-3.5 w-3.5 rounded border-border accent-accent"
              />
              {item.label}
            </label>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {steps.map((item) => (
            <Button key={item.value} size="sm" variant={step === item.value ? "secondary" : "outline"} onClick={() => selectStep(item.value)}>
              {item.label}
              {drafts[item.value] && <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-accent" aria-label="Unsaved AI draft" />}
            </Button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Select value={language} onChange={(event) => selectLanguage(event.target.value)} className="h-8 w-auto px-2.5 text-xs">
            {LANGUAGES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </Select>
          <Button size="sm" variant="outline" disabled={generating || !stepsToGenerate.length} onClick={generate}>
            {generating ? "Writing…" : "Generate with AI"}
          </Button>
        </div>
      </div>
      <div className="grid gap-3">
        <div className="space-y-1">
          <Label>Subject</Label>
          <Input value={subject} onChange={(event) => setSubject(event.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Body</Label>
          <p className="text-xs text-muted">Use variables such as {"{{business_name}}"}, {"{{town}}"}, and {"{{project_name}}"}.</p>
          <Textarea rows={9} value={body} onChange={(event) => setBody(event.target.value)} />
        </div>
        <div className="flex items-center gap-3">
          <Button disabled={busy || !subject.trim() || !body.trim()} onClick={save}>{busy ? "Saving…" : "Save template"}</Button>
          {message && <p className="text-sm text-muted" role="status">{message}</p>}
        </div>
      </div>
    </div>
  );
}
