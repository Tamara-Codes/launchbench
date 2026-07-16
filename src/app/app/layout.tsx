import { redirect } from "next/navigation";
import { TenantSidebar } from "@/components/tenant-sidebar";
import { getTenantContext } from "@/server/tenant-context";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const context = await getTenantContext();
  if (!context) redirect("/onboarding");

  return (
    <div className="flex min-h-[100dvh] flex-col md:flex-row">
      <TenantSidebar workspaceName={context.workspace.name} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

