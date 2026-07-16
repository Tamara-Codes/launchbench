import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader, Table, Td, Th, Thead, Tr } from "@/components/ui";
import { TenantSalesPanel } from "@/components/tenant-sales-panel";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/server/tenant-context";

export const dynamic = "force-dynamic";
export default async function TenantSalesPage() {
  const context = await getTenantContext(); if (!context) redirect("/onboarding"); const supabase = await createClient();
  const [{ data: products }, { data: territories }, { data: leads }] = await Promise.all([
    supabase.from("products").select("id, name").eq("workspace_id", context.workspace.id).eq("active", true).order("name"),
    supabase.from("territories").select("id, product_id, town, country").eq("workspace_id", context.workspace.id).order("town"),
    supabase.from("sales_leads").select("id, business_name, town, email, website, status, lead_score, created_at").eq("workspace_id", context.workspace.id).order("created_at", { ascending: false }).limit(100),
  ]);
  return <main className="mx-auto max-w-6xl px-6 py-12"><Link className="text-sm text-accent" href="/app">← Workspace</Link><div className="mt-5"><PageHeader title="Sales Agent" description="Define territory boundaries, queue research, and review qualified leads." /></div><div className="mt-8"><TenantSalesPanel products={products ?? []} territories={territories ?? []} /></div><section className="mt-10"><h2 className="font-semibold text-ink-strong">Recent leads</h2><div className="mt-3 rounded-xl border"><Table><Thead><Tr><Th>Business</Th><Th>Town</Th><Th>Contact</Th><Th>Status</Th><Th>Score</Th></Tr></Thead><tbody>{leads?.map((lead) => <Tr key={lead.id}><Td>{lead.business_name}</Td><Td>{lead.town}</Td><Td>{lead.email || lead.website || "—"}</Td><Td>{lead.status}</Td><Td>{lead.lead_score}</Td></Tr>)}</tbody></Table>{!leads?.length && <p className="p-5 text-sm text-muted">No leads yet. Queue a Sales Agent run after adding a territory.</p>}</div></section></main>;
}
