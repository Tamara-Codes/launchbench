import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

/** Name of the cookie holding the user's currently selected project (product). */
export const CURRENT_PROJECT_COOKIE = "lb_current_project";

export type CurrentProject = { id: string; name: string };

/** Resolves the active project for a workspace from the current-project cookie,
 * falling back to the first active product. Returns null when the workspace has
 * no active products yet. This is the single source of truth for "what am I
 * working on" — pages scope their data to it instead of asking again in a form. */
export async function getCurrentProject(workspaceId: string): Promise<CurrentProject | null> {
  const supabase = await createClient();
  const { data: products } = await supabase
    .from("products")
    .select("id, name")
    .eq("workspace_id", workspaceId)
    .eq("active", true)
    .order("name");
  if (!products?.length) return null;
  const cookieId = (await cookies()).get(CURRENT_PROJECT_COOKIE)?.value;
  const selected = products.find((product) => product.id === cookieId) ?? products[0]!;
  return { id: selected.id, name: selected.name };
}
