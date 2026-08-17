import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { TenantSettingsTabs } from "@/components/tenant-settings-tabs";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { composioGmail } from "@/providers/composio";
import { getTenantContext } from "@/server/tenant-context";

export const dynamic = "force-dynamic";
export default async function TenantSettingsPage() { const context = await getTenantContext(); if (!context) redirect("/onboarding"); const supabase = await createClient(); const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  // integration_connections only grants SELECT to workspace admins via RLS
  // (its connection id/email are sensitive config data) — read it with the
  // admin client so members don't wrongly see Gmail as disconnected.
  const [{ data: connection }, { count: salesRuns }, { count: leadsFound }, { count: contentItems }] = await Promise.all([createAdminClient().from("integration_connections").select("status, connected_email, composio_connection_id").eq("workspace_id", context.workspace.id).eq("provider", "gmail").maybeSingle(), supabase.from("sales_runs").select("id", { count: "exact", head: true }).eq("workspace_id", context.workspace.id).gte("created_at", monthStart.toISOString()), supabase.from("sales_leads").select("id", { count: "exact", head: true }).eq("workspace_id", context.workspace.id).gte("created_at", monthStart.toISOString()), supabase.from("content_items").select("id", { count: "exact", head: true }).eq("workspace_id", context.workspace.id).gte("created_at", monthStart.toISOString())]); let gmailConnection = connection; if (connection?.status === "active" && !connection.connected_email && composioGmail.isConfigured()) { try { const email = (await composioGmail.getStatus(connection.composio_connection_id)).accountEmail; if (email) { await createAdminClient().from("integration_connections").update({ connected_email: email }).eq("workspace_id", context.workspace.id).eq("provider", "gmail"); gmailConnection = { ...connection, connected_email: email }; } } catch { /* The account remains connected even if the optional lookup fails. */ } } return <main className="mx-auto max-w-6xl px-6 py-12"><PageHeader title="Settings" description="Gmail connection and workspace usage." /><div className="mt-8"><TenantSettingsTabs connection={gmailConnection} usage={{ salesRuns: salesRuns ?? 0, leadsFound: leadsFound ?? 0, contentItems: contentItems ?? 0 }} /></div></main>; }
