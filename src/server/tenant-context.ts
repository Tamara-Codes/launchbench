import "server-only";
import { createClient } from "@/lib/supabase/server";

export type TenantContext = {
  userId: string;
  email: string;
  workspace: { id: string; name: string; slug: string };
  role: "owner" | "admin" | "member";
};

/** Resolves the current user's first workspace through RLS. Workspace switching
 * will build on this boundary later; never accept a workspace ID from a form as
 * proof of authorization. */
export async function getTenantContext(): Promise<TenantContext | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (!membership) return null;
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name, slug")
    .eq("id", membership.workspace_id)
    .maybeSingle();
  if (!workspace) return null;
  return {
    userId: user.id,
    email: user.email ?? "",
    workspace,
    role: membership.role as TenantContext["role"],
  };
}
