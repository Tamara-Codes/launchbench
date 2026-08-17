"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "./ui";
import { approveTenantLead } from "@/server/tenant-sales-actions";

type Lead = {
  id: string;
  email: string;
  status: string;
  draft_subject: string;
  draft_body: string;
};

export function TenantLeadDraftReview({ lead, gmailConnected }: { lead: Lead; gmailConnected: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const reviewed = lead.status !== "awaiting_review";
  const mailto = lead.email
    ? `mailto:${encodeURIComponent(lead.email)}?subject=${encodeURIComponent(lead.draft_subject)}&body=${encodeURIComponent(lead.draft_body)}`
    : "";

  async function approve() {
    setBusy(true);
    setMessage("");
    const result = await approveTenantLead(lead.id);
    setBusy(false);
    if (!result.ok) { setMessage(result.error); return; }
    router.refresh();
  }

  return (
    <details>
      <summary className="cursor-pointer font-medium text-accent">Review draft</summary>
      <div className="mt-3 rounded-lg border bg-surface2 p-3 text-sm">
        <p className="font-semibold text-ink-strong">{lead.draft_subject || "(No subject)"}</p>
        <p className="mt-3 whitespace-pre-wrap leading-6 text-ink">{lead.draft_body}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {mailto && (
            <a className="text-sm font-semibold text-accent hover:underline" href={mailto}>
              Open in email app →
            </a>
          )}
          {reviewed ? (
            <span className="text-xs text-muted">{lead.status === "approved" ? "Approved — draft created in Gmail." : lead.status}</span>
          ) : gmailConnected ? (
            <Button size="sm" disabled={busy} onClick={approve}>
              {busy ? "Creating Gmail draft…" : "Approve — create Gmail draft"}
            </Button>
          ) : (
            <span className="text-xs text-muted">
              <Link href="/app/settings" className="text-accent hover:underline">Connect Gmail</Link> to approve and draft this in your inbox.
            </span>
          )}
        </div>
        {message && <p className="mt-2 text-xs text-danger" role="status">{message}</p>}
      </div>
    </details>
  );
}
