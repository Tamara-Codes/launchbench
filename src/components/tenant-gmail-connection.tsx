"use client";

import { useState } from "react";
import { disconnectTenantGmailConnection, initiateTenantGmailConnection, refreshTenantGmailConnection } from "@/server/tenant-gmail-actions";
import { Button } from "./ui";

export function TenantGmailConnection({ connection }: { connection: { status: string; connected_email: string } | null }) {
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  async function connect() { setBusy(true); setMessage(""); const result = await initiateTenantGmailConnection(); setBusy(false); if (!result.ok) setMessage(result.error); else window.location.assign(result.data.redirectUrl); }
  async function refresh() { setBusy(true); const result = await refreshTenantGmailConnection(); setBusy(false); setMessage(result.ok ? "Connection refreshed." : result.error); }
  async function disconnect() { setBusy(true); const result = await disconnectTenantGmailConnection(); setBusy(false); setMessage(result.ok ? "Disconnected." : result.error); window.location.reload(); }
  return <div className="flex flex-wrap items-center gap-3"><p className="text-sm text-muted">{connection?.status === "active" ? `Connected: ${connection.connected_email || "Gmail"}` : "No active Gmail connection."}</p>{connection ? <><Button variant="outline" disabled={busy} onClick={refresh}>Refresh</Button><Button variant="danger" disabled={busy} onClick={disconnect}>Disconnect</Button></> : <Button disabled={busy} onClick={connect}>{busy ? "Opening…" : "Connect Gmail"}</Button>}{message && <p className="w-full text-sm text-muted" role="status">{message}</p>}</div>;
}
