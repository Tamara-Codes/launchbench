"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { composioGmail } from "@/providers/composio";
import { getEnv } from "@/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantContext } from "./tenant-context";

function requireAdmin(context: Awaited<ReturnType<typeof getTenantContext>>) {
  if (!context || context.role === "member") throw new Error("Only workspace owners and admins can manage Gmail.");
  return context;
}

export async function initiateTenantGmailConnection() {
  try {
    const context = requireAdmin(await getTenantContext());
    if (!composioGmail.isConfigured()) throw new Error("Composio Gmail is not configured on the server.");
    const state = randomBytes(32).toString("base64url"); const callbackUrl = `${getEnv().NEXT_PUBLIC_APP_URL}/api/composio/gmail/callback?state=${encodeURIComponent(state)}`;
    const initiated = await composioGmail.initiate(context.workspace.id, callbackUrl); if (!initiated.redirectUrl || !initiated.connectionId) throw new Error("Composio did not return a connection URL.");
    const admin = createAdminClient(); const { error } = await admin.from("integration_connections").upsert({ workspace_id: context.workspace.id, provider: "gmail", composio_connection_id: initiated.connectionId, status: "pending", connected_email: "", last_error: "", oauth_state: state }, { onConflict: "workspace_id,provider" });
    if (error) throw new Error(error.message); revalidatePath("/app/settings"); return { ok: true as const, data: { redirectUrl: initiated.redirectUrl } };
  } catch (error) { return { ok: false as const, error: error instanceof Error ? error.message : "Could not connect Gmail." }; }
}

export async function disconnectTenantGmailConnection() {
  try {
    const context = requireAdmin(await getTenantContext()); const admin = createAdminClient(); const { data: connection } = await admin.from("integration_connections").select("composio_connection_id").eq("workspace_id", context.workspace.id).eq("provider", "gmail").maybeSingle();
    if (connection) await composioGmail.disconnect(connection.composio_connection_id);
    const { error } = await admin.from("integration_connections").delete().eq("workspace_id", context.workspace.id).eq("provider", "gmail"); if (error) throw new Error(error.message);
    revalidatePath("/app/settings"); return { ok: true as const };
  } catch (error) { return { ok: false as const, error: error instanceof Error ? error.message : "Could not disconnect Gmail." }; }
}
