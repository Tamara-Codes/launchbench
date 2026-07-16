import { PageHeader } from "@/components/ui";
import { EmailQueueClient } from "@/components/email-queue-client";
import { getGmailConnection, listDrafts } from "@/server/repo";
import { getSelectedProduct } from "@/server/product-context";

export const dynamic = "force-dynamic";

export default async function EmailQueuePage() {
  const product = await getSelectedProduct();
  const [rows, conn] = await Promise.all([
    listDrafts(["draft", "approved", "gmailDraftCreated"], product?.id),
    getGmailConnection(),
  ]);
  const drafts = rows
    .filter((r) => r.lead)
    .map((r) => ({
      id: r.draft.id,
      leadId: r.draft.leadId,
      businessName: r.lead!.businessName,
      emailType: r.draft.emailType,
      language: r.draft.language,
      recipientEmail: r.draft.recipientEmail,
      subject: r.draft.subject,
      body: r.draft.body,
      status: r.draft.status,
      warnings: r.draft.warnings,
      unresolvedVariables: r.draft.unresolvedVariables,
      sourceFactsUsed: r.draft.sourceFactsUsed,
      createdAt: r.draft.createdAt.toISOString(),
    }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Email Queue"
        description={`Review and approve outreach for ${product?.name ?? "your selected product"}. Nothing is sent without your explicit approval.`}
      />
      <EmailQueueClient drafts={drafts} gmailConnected={conn?.status === "active"} />
    </div>
  );
}
