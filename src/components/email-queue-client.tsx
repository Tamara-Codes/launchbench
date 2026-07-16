"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, Check, RefreshCw, X, FileText, AlertTriangle } from "lucide-react";
import { Badge, Button, Card, CardContent, EmptyState, Input, Textarea } from "./ui";
import { DraftStatusBadge } from "./status";
import { toast } from "./toast";
import {
  approveDraft,
  bulkApprove,
  bulkSend,
  createGmailDraftAction,
  regenerateDraft,
  rejectDraft,
  sendDraftAction,
  updateDraft,
} from "@/server/actions";
import { Mail } from "lucide-react";

interface DraftItem {
  id: string;
  leadId: string;
  businessName: string;
  emailType: string;
  language: string;
  recipientEmail: string;
  subject: string;
  body: string;
  status: string;
  warnings: string[];
  unresolvedVariables: string[];
  sourceFactsUsed: string[];
  createdAt: string;
}

export function EmailQueueClient({ drafts, gmailConnected }: { drafts: DraftItem[]; gmailConnected: boolean }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(drafts[0]?.id ?? null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const selected = drafts.find((d) => d.id === selectedId) ?? null;

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runBulkApprove() {
    if (checked.size === 0) return;
    setBusy(true);
    const res = await bulkApprove(Array.from(checked));
    setBusy(false);
    if (res.ok) {
      toast(`Approved ${res.data?.approved ?? 0} draft(s).`, "success");
      setChecked(new Set());
      router.refresh();
    } else toast(res.error, "error");
  }

  async function runBulkSend() {
    if (checked.size === 0) return;
    const ids = Array.from(checked);
    const recipients = drafts.filter((d) => ids.includes(d.id)).map((d) => d.recipientEmail);
    if (!window.confirm(`Send ${ids.length} email(s) to:\n\n${recipients.join("\n")}\n\nProceed?`)) return;
    setBusy(true);
    const res = await bulkSend(ids);
    setBusy(false);
    if (res.ok) {
      toast(`Sent ${res.data?.sent ?? 0}, failed ${res.data?.failed ?? 0}.`, res.data?.failed ? "info" : "success");
      setChecked(new Set());
      router.refresh();
    } else toast(res.error, "error");
  }

  if (drafts.length === 0) {
    return (
      <EmptyState
        icon={<Mail className="h-8 w-8" />}
        title="No emails awaiting review"
        description="Generate an email from a lead's page or the Follow-ups page to see it here."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">{checked.size} selected</span>
        <Button size="sm" variant="secondary" disabled={busy || checked.size === 0} onClick={runBulkApprove}>
          <Check className="h-4 w-4" /> Approve selected
        </Button>
        <Button size="sm" variant="primary" disabled={busy || checked.size === 0 || !gmailConnected} onClick={runBulkSend}>
          <Send className="h-4 w-4" /> Send approved
        </Button>
        {!gmailConnected && (
          <span className="flex items-center gap-1 text-xs text-warning">
            <AlertTriangle className="h-3.5 w-3.5" /> Connect Gmail in Settings to send.
          </span>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* List */}
        <div className="space-y-2 lg:col-span-2">
          {drafts.map((d) => (
            <button
              key={d.id}
              onClick={() => setSelectedId(d.id)}
              className={`flex w-full items-start gap-2 rounded-lg border p-3 text-left transition-colors ${
                selectedId === d.id ? "border-accent bg-accent-soft/50" : "bg-surface hover:bg-surface2"
              }`}
            >
              <input
                type="checkbox"
                checked={checked.has(d.id)}
                onChange={(e) => {
                  e.stopPropagation();
                  toggle(d.id);
                }}
                onClick={(e) => e.stopPropagation()}
                className="mt-1"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium text-ink-strong">{d.businessName}</span>
                  <DraftStatusBadge status={d.status} />
                </div>
                <p className="truncate text-xs text-muted">{d.subject}</p>
                <div className="mt-1 flex items-center gap-2">
                  <Badge tone="neutral">{d.emailType}</Badge>
                  <span className="text-xs uppercase text-muted">{d.language}</span>
                  {d.warnings.length > 0 && <AlertTriangle className="h-3.5 w-3.5 text-warning" />}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Editor */}
        <div className="lg:col-span-3">
          {selected ? (
            <DraftEditor key={selected.id} draft={selected} gmailConnected={gmailConnected} onChanged={() => router.refresh()} />
          ) : (
            <Card>
              <CardContent className="py-16 text-center text-muted">Select a draft to review.</CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function DraftEditor({
  draft,
  gmailConnected,
  onChanged,
}: {
  draft: DraftItem;
  gmailConnected: boolean;
  onChanged: () => void;
}) {
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);
  const [busy, setBusy] = useState<string | null>(null);
  const dirty = subject !== draft.subject || body !== draft.body;
  const canSend = draft.status === "approved" && !dirty;

  async function act(name: string, fn: () => Promise<{ ok: boolean; error?: string; data?: any }>, success: string) {
    setBusy(name);
    const res = await fn();
    setBusy(null);
    if (res.ok) {
      toast(success, "success");
      onChanged();
    } else toast(res.error ?? "Error", "error");
  }

  return (
    <Card>
      <CardContent className="space-y-3 pt-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-ink-strong">{draft.businessName}</p>
            <p className="text-sm text-muted">To: {draft.recipientEmail}</p>
          </div>
          <DraftStatusBadge status={draft.status} />
        </div>

        {draft.warnings.length > 0 && (
          <div className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">
            {draft.warnings.map((w, i) => (
              <p key={i}>{w}</p>
            ))}
          </div>
        )}
        {draft.sourceFactsUsed.length > 0 && (
          <p className="text-xs text-muted">
            Personalization facts: {draft.sourceFactsUsed.join("; ")}
          </p>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted">Subject</label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted">Body</label>
          <Textarea rows={14} value={body} onChange={(e) => setBody(e.target.value)} className="font-mono text-xs" />
        </div>

        <div className="flex flex-wrap gap-2 border-t pt-3">
          <Button
            size="sm"
            variant="secondary"
            disabled={!dirty || !!busy}
            onClick={() => act("save", () => updateDraft(draft.id, { subject, body }), "Saved.")}
          >
            {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} Save edits
          </Button>
          <Button
            size="sm"
            variant="success"
            disabled={draft.status === "sent" || dirty || !!busy}
            onClick={() => act("approve", () => approveDraft(draft.id), "Approved.")}
          >
            <Check className="h-4 w-4" /> Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!!busy}
            onClick={() => act("regen", () => regenerateDraft(draft.id), "Regenerated.")}
          >
            <RefreshCw className="h-4 w-4" /> Regenerate
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!gmailConnected || !!busy || dirty}
            onClick={() => act("gmail", () => createGmailDraftAction(draft.id), "Gmail draft created.")}
          >
            <Mail className="h-4 w-4" /> Gmail draft
          </Button>
          <Button
            size="sm"
            variant="primary"
            disabled={!canSend || !gmailConnected || !!busy}
            onClick={() => {
              if (!window.confirm(`Send this email to ${draft.recipientEmail}?`)) return;
              act("send", () => sendDraftAction(draft.id), "Email sent.");
            }}
          >
            {busy === "send" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send now
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={!!busy}
            onClick={() => act("reject", () => rejectDraft(draft.id), "Rejected.")}
          >
            <X className="h-4 w-4" /> Reject
          </Button>
        </div>
        {dirty && <p className="text-xs text-warning">Save edits before approving or sending.</p>}
      </CardContent>
    </Card>
  );
}
