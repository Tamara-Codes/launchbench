import { PageHeader } from "@/components/ui";
import { TenantProjectForm } from "@/components/tenant-project-form";

export default function NewTenantProjectPage() {
  return <main className="mx-auto w-full max-w-7xl px-6 py-12"><PageHeader title="New project" description="Create the project context that keeps Sales and Content work accurate." /><div className="mt-8 rounded-xl border bg-surface p-6"><TenantProjectForm /></div></main>;
}
