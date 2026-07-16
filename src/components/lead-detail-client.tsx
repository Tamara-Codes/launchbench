"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Pencil, Save, X, Loader2 } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "./ui";
import { Select } from "./ui-select";
import { toast } from "./toast";
import { generateEmail, setLeadStatus, updateLead } from "@/server/actions";
import type { EmailType, LeadStatus } from "@/db/schema";

interface LeadLite {
  id: string;
  businessName: string;
  email: string;
  phone: string;
  website: string;
  town: string;
  settlement: string;
  estimatedUnits: number | null;
  notes: string;
  languagePreference: string;
  status: LeadStatus;
}

const STATUS_OPTIONS: LeadStatus[] = [
  "awaitingReview",
  "approved",
  "rejected",
  "contacted",
  "replied",
  "interested",
  "customer",
  "notInterested",
  "optedOut",
  "invalidContact",
  "duplicate",
];

export function LeadQuickActions({ lead }: { lead: LeadLite }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [lang, setLang] = useState(lead.languagePreference || "hr");

  async function changeStatus(status: LeadStatus) {
    setBusy(true);
    const res = await setLeadStatus(lead.id, status, "Manual change");
    setBusy(false);
    if (res.ok) {
      toast(`Status → ${status}`, "success");
      router.refresh();
    } else toast(res.error, "error");
  }

  async function gen(type: EmailType) {
    if (!lead.email) return toast("Lead has no email; add one first.", "error");
    setBusy(true);
    const res = await generateEmail(lead.id, type, lang);
    setBusy(false);
    if (res.ok) {
      toast("Draft generated — see Email Queue.", "success");
      if (res.data?.warnings?.length) res.data.warnings.forEach((w) => toast(w, "info"));
      router.push("/email-queue");
    } else toast(res.error, "error");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="success" disabled={busy} onClick={() => changeStatus("approved")}>
            Approve
          </Button>
          <Button size="sm" variant="danger" disabled={busy} onClick={() => changeStatus("rejected")}>
            Reject
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => changeStatus("interested")}>
            Mark interested
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => changeStatus("customer")}>
            Won
          </Button>
        </div>

        <div className="space-y-1.5">
          <Label>Set status</Label>
          <Select value={lead.status} onChange={(e) => changeStatus(e.target.value as LeadStatus)} disabled={busy}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5 border-t pt-3">
          <Label>Generate email ({lang.toUpperCase()})</Label>
          <div className="flex gap-2">
            <Select value={lang} onChange={(e) => setLang(e.target.value)} className="w-24">
              <option value="hr">HR</option>
              <option value="en">EN</option>
            </Select>
            <Button size="sm" className="flex-1" disabled={busy} onClick={() => gen("initial")}>
              <Mail className="h-4 w-4" /> Initial email
            </Button>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="flex-1" disabled={busy} onClick={() => gen("follow_up_1")}>
              Follow-up 1
            </Button>
            <Button size="sm" variant="outline" className="flex-1" disabled={busy} onClick={() => gen("follow_up_final")}>
              Final follow-up
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function LeadEditForm({ lead }: { lead: LeadLite }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(lead);

  function set<K extends keyof LeadLite>(k: K, v: LeadLite[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    setSaving(true);
    const res = await updateLead(lead.id, {
      businessName: form.businessName,
      email: form.email,
      phone: form.phone,
      website: form.website,
      town: form.town,
      settlement: form.settlement,
      estimatedUnits: form.estimatedUnits,
      notes: form.notes,
      languagePreference: form.languagePreference,
    });
    setSaving(false);
    if (res.ok) {
      toast("Lead updated.", "success");
      setEditing(false);
      router.refresh();
    } else toast(res.error, "error");
  }

  if (!editing) {
    return (
      <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
        <Pencil className="h-4 w-4" /> Edit
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Edit lead</CardTitle>
          <button onClick={() => setEditing(false)} className="text-muted hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <Field label="Business name" value={form.businessName} onChange={(v) => set("businessName", v)} />
        <Field label="Email" value={form.email} onChange={(v) => set("email", v)} />
        <Field label="Phone" value={form.phone} onChange={(v) => set("phone", v)} />
        <Field label="Website" value={form.website} onChange={(v) => set("website", v)} />
        <Field label="Town" value={form.town} onChange={(v) => set("town", v)} />
        <Field label="Settlement" value={form.settlement} onChange={(v) => set("settlement", v)} />
        <div className="space-y-1.5">
          <Label>Estimated units</Label>
          <Input
            type="number"
            value={form.estimatedUnits ?? ""}
            onChange={(e) => set("estimatedUnits", e.target.value ? Number(e.target.value) : null)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Language</Label>
          <Select value={form.languagePreference} onChange={(e) => set("languagePreference", e.target.value)}>
            <option value="hr">Croatian</option>
            <option value="en">English</option>
          </Select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Notes</Label>
          <Input value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save changes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
