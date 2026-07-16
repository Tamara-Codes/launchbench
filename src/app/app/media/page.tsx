import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { TenantMediaUpload } from "@/components/tenant-media-upload";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/server/tenant-context";

export const dynamic = "force-dynamic";
export default async function TenantMediaPage() {
  const context = await getTenantContext(); if (!context) redirect("/onboarding"); const supabase = await createClient(); const admin = createAdminClient();
  const [{ data: products }, { data: assets }] = await Promise.all([supabase.from("products").select("id, name").eq("workspace_id", context.workspace.id).order("name"), supabase.from("workspace_media_assets").select("id, file_name, mime_type, byte_size, storage_path, created_at").eq("workspace_id", context.workspace.id).order("created_at", { ascending: false }).limit(100)]);
  const files = await Promise.all((assets ?? []).map(async (asset) => ({ ...asset, url: (await admin.storage.from("workspace-media").createSignedUrl(asset.storage_path, 3600)).data?.signedUrl ?? "" })));
  return <main className="mx-auto max-w-6xl px-6 py-12"><Link className="text-sm text-accent" href="/app">← Workspace</Link><div className="mt-5"><PageHeader title="Media library" description="Private product images stored in your workspace." /></div><div className="mt-8"><TenantMediaUpload products={products ?? []} /></div><div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{files.map((file) => <article key={file.id} className="overflow-hidden rounded-xl border"><a href={file.url} target="_blank" rel="noreferrer">{file.url ? <img src={file.url} alt="" className="h-44 w-full object-cover" /> : <div className="h-44 bg-surface2" />}</a><p className="truncate p-3 text-sm text-ink-strong">{file.file_name}</p></article>)}</div></main>;
}
