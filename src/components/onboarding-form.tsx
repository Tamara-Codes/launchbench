"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "./ui";

function slugify(value: string) {
  return value.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

export function OnboardingForm() {
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceSlug, setWorkspaceSlug] = useState("");
  const [productName, setProductName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const supabase = createClient();
    const slug = slugify(workspaceSlug || workspaceName);
    const { data: workspace, error: workspaceError } = await supabase.rpc("create_workspace", {
      workspace_name: workspaceName,
      workspace_slug: slug,
    });
    if (workspaceError || !workspace) {
      setBusy(false);
      setError(workspaceError?.message ?? "Could not create your workspace.");
      return;
    }
    const { error: productError } = await supabase.from("products").insert({
      workspace_id: workspace.id,
      name: productName,
    });
    if (productError) {
      setBusy(false);
      setError("Workspace created, but the first product could not be created. Please try again.");
      return;
    }
    window.location.assign("/app");
  }

  return (
    <Card className="mx-auto w-full max-w-xl">
      <CardHeader><CardTitle>Create your workspace</CardTitle><p className="text-sm text-muted">Start with the business and first product you want your agents to work on.</p></CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-1.5"><Label>Business or workspace name</Label><Input value={workspaceName} onChange={(event) => { setWorkspaceName(event.target.value); if (!workspaceSlug) setWorkspaceSlug(slugify(event.target.value)); }} required maxLength={120} /></div>
          <div className="space-y-1.5"><Label>Workspace URL name</Label><Input value={workspaceSlug} onChange={(event) => setWorkspaceSlug(slugify(event.target.value))} required maxLength={60} /><p className="text-xs text-muted">Lowercase letters, numbers, and hyphens only.</p></div>
          <div className="space-y-1.5"><Label>First product or project</Label><Input value={productName} onChange={(event) => setProductName(event.target.value)} required maxLength={160} placeholder="e.g. Digital Guest Welcome Book" /></div>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <Button className="w-full" disabled={busy}>{busy ? "Creating workspace…" : "Create workspace"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
