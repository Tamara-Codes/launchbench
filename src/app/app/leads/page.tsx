import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader, Table, Td, Th, Thead, Tr } from "@/components/ui";
import { TenantLeadDraftReview } from "@/components/tenant-lead-draft-review";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantContext } from "@/server/tenant-context";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const context = await getTenantContext();
  if (!context) redirect("/onboarding");

  const supabase = await createClient();
  const [{ data: leads }, { data: gmailConnection }] = await Promise.all([
    supabase
      .from("sales_leads")
      .select(
        "id, business_name, town, email, phone, website, status, lead_score, confidence, draft_subject, draft_body, draft_generated_at, created_at",
      )
      .eq("workspace_id", context.workspace.id)
      .order("created_at", { ascending: false })
      .limit(200),
    // integration_connections only grants SELECT to workspace admins via RLS
    // (its connection id/email are sensitive config data) — read it with the
    // admin client so members don't wrongly see Gmail as disconnected.
    createAdminClient()
      .from("integration_connections")
      .select("status")
      .eq("workspace_id", context.workspace.id)
      .eq("provider", "gmail")
      .maybeSingle(),
  ]);
  const gmailConnected = gmailConnection?.status === "active";

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <Link className="text-sm text-accent" href="/app/sales">
        ← Sales Agent
      </Link>
      <div className="mt-5">
        <PageHeader
          title="Leads"
          description="Review qualified businesses and their prepared email drafts. Approving creates a draft in your connected Gmail account — nothing is ever sent automatically."
        />
      </div>
      <div className="mt-8 overflow-x-auto rounded-xl border">
        <Table>
          <Thead>
            <Tr>
              <Th>Business</Th>
              <Th>Town</Th>
              <Th>Contact</Th>
              <Th>Status</Th>
              <Th>Score</Th>
              <Th>Email draft</Th>
            </Tr>
          </Thead>
          <tbody>
            {leads?.map((lead) => {
              const hasDraft = Boolean(lead.draft_subject || lead.draft_body);
              return (
                <Tr key={lead.id}>
                  <Td>{lead.business_name}</Td>
                  <Td>{lead.town || "—"}</Td>
                  <Td>{lead.email || lead.phone || lead.website || "—"}</Td>
                  <Td>{lead.status}</Td>
                  <Td>
                    {lead.lead_score} · {Math.round(Number(lead.confidence) * 100)}%
                  </Td>
                  <Td className="min-w-80 max-w-lg">
                    {hasDraft ? (
                      <TenantLeadDraftReview lead={lead} gmailConnected={gmailConnected} />
                    ) : (
                      <span className="text-muted">Not generated</span>
                    )}
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
        {!leads?.length && (
          <p className="p-5 text-sm text-muted">
            No leads yet. Start a Sales Agent run to research your active territory.
          </p>
        )}
      </div>
    </main>
  );
}
