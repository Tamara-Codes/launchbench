import { redirect } from "next/navigation";
import { TenantSidebar } from "@/components/tenant-sidebar";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/server/tenant-context";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const context = await getTenantContext();
  if (!context) redirect("/onboarding");
  const supabase = await createClient();
  const { data: products } = await supabase
    .from("products")
    .select("id, name, active")
    .eq("workspace_id", context.workspace.id)
    .order("name");

  return (
    <div className="flex min-h-[100dvh] flex-col md:flex-row">
      <TenantSidebar workspaceName={context.workspace.name} products={products ?? []} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
