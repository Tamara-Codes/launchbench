import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader, Table, Td, Th, Thead, Tr } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/server/tenant-context";

export const dynamic = "force-dynamic";
export default async function LeadsPage() {
  const context = await getTenantContext(); if (!context) redirect("/onboarding"); const supabase = await createClient();
  const { data: leads } = await supabase.from("sales_leads").select("id, business_name, town, email, phone, website, status, lead_score, confidence, created_at").eq("workspace_id", context.workspace.id).order("created_at", { ascending: false }).limit(200);
  return <main className="mx-auto max-w-6xl px-6 py-12"><Link className="text-sm text-accent" href="/app/sales">← Sales Agent</Link><div className="mt-5"><PageHeader title="Leads" description="Qualified businesses found by the Sales Agent for this workspace." /></div><div className="mt-8 overflow-hidden rounded-xl border"><Table><Thead><Tr><Th>Business</Th><Th>Town</Th><Th>Contact</Th><Th>Status</Th><Th>Score</Th></Tr></Thead><tbody>{leads?.map((lead) => <Tr key={lead.id}><Td>{lead.business_name}</Td><Td>{lead.town || "—"}</Td><Td>{lead.email || lead.phone || lead.website || "—"}</Td><Td>{lead.status}</Td><Td>{lead.lead_score} · {Math.round(Number(lead.confidence) * 100)}%</Td></Tr>)}</tbody></Table>{!leads?.length && <p className="p-5 text-sm text-muted">No leads yet. Start a Sales Agent run to research your active territory.</p>}</div></main>;
}
