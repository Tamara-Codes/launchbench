"use client";

import { useState } from "react";
import { disconnectTenantGmailConnection, initiateTenantGmailConnection } from "@/server/tenant-gmail-actions";
import { Button } from "./ui";

export function TenantGmailConnection({ connection }: { connection: { status: string; connected_email: string } | null }) {
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  async function connect() { setBusy(true); setMessage(""); const result = await initiateTenantGmailConnection(); setBusy(false); if (!result.ok) setMessage(result.error); else window.location.assign(result.data.redirectUrl); }
  async function disconnect() { setBusy(true); const result = await disconnectTenantGmailConnection(); setBusy(false); setMessage(result.ok ? "Disconnected." : result.error); window.location.reload(); }
  return <div className="flex flex-wrap items-center gap-3">{connection?.status === "active" ? <div className="min-w-full rounded-lg border border-border bg-surface2 px-4 py-3"><p className="text-xs font-medium uppercase tracking-wide text-muted">Connected Gmail account</p><p className="mt-1 text-sm font-medium text-ink">{connection.connected_email || "Account address is being confirmed…"}</p></div> : <p className="text-sm text-muted">No active Gmail connection.</p>}{connection ? <Button variant="danger" disabled={busy} onClick={disconnect}>Disconnect Gmail</Button> : <Button disabled={busy} onClick={connect}>{busy ? "Opening…" : "Connect Gmail"}</Button>}{message && <p className="w-full text-sm text-muted" role="status">{message}</p>}</div>;
}
