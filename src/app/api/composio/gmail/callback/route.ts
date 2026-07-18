import { NextResponse, type NextRequest } from "next/server";
import { composioGmail } from "@/providers/composio";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const state = request.nextUrl.searchParams.get("state") ?? ""; if (!state) return NextResponse.redirect(new URL("/app/settings?gmail=invalid", request.url));
  const admin = createAdminClient(); const { data: connection } = await admin.from("integration_connections").select("workspace_id, composio_connection_id").eq("oauth_state", state).eq("provider", "gmail").maybeSingle();
  if (!connection) return NextResponse.redirect(new URL("/app/settings?gmail=invalid", request.url));
  try { const status = await composioGmail.getStatus(connection.composio_connection_id); await admin.from("integration_connections").update({ status: status.status === "active" ? "active" : "pending", connected_email: status.accountEmail, oauth_state: "" }).eq("workspace_id", connection.workspace_id).eq("provider", "gmail"); } catch { /* A later settings visit retries the account lookup. */ }
  return NextResponse.redirect(new URL("/app/settings?gmail=connected", request.url));
}
