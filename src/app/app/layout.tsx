import { redirect } from "next/navigation";
import { TenantSidebar } from "@/components/tenant-sidebar";
import { OpsChatWidget } from "@/components/ops-chat-widget";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/server/tenant-context";
import { getCurrentProject } from "@/server/current-project";

export const metadata = {
  robots: { index: false, follow: false },
};

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const context = await getTenantContext();
  if (!context) redirect("/onboarding");
  const supabase = await createClient();
  const { data: products } = await supabase
    .from("products")
    .select("id, name, active")
    .eq("workspace_id", context.workspace.id)
    .order("name");
  const { data: agents } = await supabase
    .from("workspace_agents")
    .select("slug, name, avatar_color")
    .eq("workspace_id", context.workspace.id);
  const salesAgent = agents?.find((agent) => agent.slug === "sales-agent") ?? { name: "Sales Agent", avatar_color: "blue" };
  const contentAgent = agents?.find((agent) => agent.slug === "content-agent") ?? { name: "Content Agent", avatar_color: "rose" };
  const currentProject = await getCurrentProject(context.workspace.id);

  return (
    <div className="flex min-h-[100dvh] flex-col md:flex-row">
      <TenantSidebar workspaceName={context.workspace.name} products={products ?? []} currentProjectId={currentProject?.id ?? null} salesAgent={salesAgent} contentAgent={contentAgent} />
      <div className="min-w-0 flex-1">{children}</div>
      {/* Every page, not just Today: thoughts arrive wherever she happens to be. */}
      <OpsChatWidget />
    </div>
  );
}
