"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserRound, Mail } from "lucide-react";
import { Button, Label } from "./ui";
import { ContextPanel, Area } from "./context-panel";
import { updateProjectEmailPersona } from "@/server/tenant-actions";

type Persona = {
  projectId: string;
  emailGenerationContext: string;
  preferredCta: string;
  senderGender: "female" | "male";
  senderSignature: string;
};

export function TenantEmailPersonaForm({
  projectId,
  initial,
}: {
  projectId: string;
  initial: Omit<Persona, "projectId">;
}) {
  const router = useRouter();
  const [form, setForm] = useState<Persona>({ projectId, ...initial });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const set = (key: keyof Omit<Persona, "projectId" | "senderGender">, value: string) => {
    setMessage("");
    setForm((current) => ({ ...current, [key]: value }));
  };

  async function save() {
    setBusy(true);
    setMessage("");
    const result = await updateProjectEmailPersona(form);
    setBusy(false);
    setMessage(result.ok ? "Saved." : result.error);
    if (result.ok) router.refresh();
  }

  return (
    <div className="space-y-3">
      <ContextPanel icon={UserRound} title="Sender identity" tone="sales">
        <div className="flex items-center gap-3">
          <Label className="!inline shrink-0">Write as</Label>
          <div className="inline-flex rounded-md border bg-surface p-0.5">
            {(["female", "male"] as const).map((gender) => (
              <button
                key={gender}
                type="button"
                onClick={() => { setMessage(""); setForm((current) => ({ ...current, senderGender: gender })); }}
                aria-pressed={form.senderGender === gender}
                className={`rounded px-2.5 py-0.5 text-xs font-medium capitalize transition-colors ${
                  form.senderGender === gender
                    ? "bg-accent text-accent-fg"
                    : "text-muted hover:text-ink"
                }`}
              >
                {gender}
              </button>
            ))}
          </div>
        </div>
        <Area
          label="Email signature"
          value={form.senderSignature}
          onChange={(value) => set("senderSignature", value)}
          rows={3}
          placeholder={"Tamara\nWelcome Book\ncodewithtamara@gmail.com"}
        />
      </ContextPanel>
      <ContextPanel icon={Mail} title="Email direction" tone="sales">
        <Area
          label="Proof points to emphasize"
          value={form.emailGenerationContext}
          onChange={(value) => set("emailGenerationContext", value)}
          rows={3}
        />
        <Area
          label="Preferred CTA"
          value={form.preferredCta}
          onChange={(value) => set("preferredCta", value)}
          rows={2}
          placeholder="e.g. Book a 15-minute call this week"
        />
      </ContextPanel>
      <div className="flex items-center gap-3">
        <Button size="sm" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save"}</Button>
        {message && <p className="text-sm text-muted" role="status">{message}</p>}
      </div>
    </div>
  );
}
