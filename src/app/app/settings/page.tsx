import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, PageHeader } from "@/components/ui";
import { TenantWorkspaceSettingsForm } from "@/components/tenant-workspace-settings-form";
import { TenantGmailConnection } from "@/components/tenant-gmail-connection";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/server/tenant-context";

export const dynamic = "force-dynamic";

export default async function TenantSettingsPage() {
  const context = await getTenantContext(); if (!context) redirect("/onboarding");
  const supabase = await createClient();
  const [{ data: settings }, { data: connection }] = await Promise.all([supabase.from("workspace_settings").select("sender_name, sender_company, sender_email, sender_signature, daily_lead_target").eq("workspace_id", context.workspace.id).maybeSingle(), supabase.from("integration_connections").select("status, connected_email").eq("workspace_id", context.workspace.id).eq("provider", "gmail").maybeSingle()]);
  if (!settings) redirect("/onboarding");
  return <main className="mx-auto max-w-4xl px-6 py-12"><Link className="text-sm text-accent" href="/app">← Workspace</Link><div className="mt-5"><PageHeader title="Workspace settings" description="Your workspace-wide sender identity. Product sales copy stays with each product instead." /></div><Card className="mt-8"><CardHeader><CardTitle>Sender profile</CardTitle><p className="text-sm text-muted">Your Gmail connection will later verify and populate the sending address.</p></CardHeader><CardContent><TenantWorkspaceSettingsForm settings={settings} /></CardContent></Card><Card className="mt-8"><CardHeader><CardTitle>Gmail via Composio</CardTitle><p className="text-sm text-muted">Each workspace authorizes its own Gmail account. OAuth tokens stay with Composio.</p></CardHeader><CardContent><TenantGmailConnection connection={connection} /></CardContent></Card></main>;
}
