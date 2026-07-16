import { PageHeader } from "@/components/ui";
import { CheckGmailButton, PrepareFollowUpsButton } from "@/components/dashboard-actions";
import { FollowUpsClient, type FollowUpItem } from "@/components/followups-client";
import { listFollowUps } from "@/server/repo";
import { classifyDue } from "@/lib/followups";
import { getSelectedProduct } from "@/server/product-context";

export const dynamic = "force-dynamic";

export default async function FollowUpsPage() {
  const product = await getSelectedProduct();
  const rows = await listFollowUps(product?.id);
  const now = new Date();

  const groups: Record<string, FollowUpItem[]> = {
    overdue: [],
    dueToday: [],
    upcoming: [],
    future: [],
    cancelled: [],
    completed: [],
  };

  for (const r of rows) {
    if (!r.lead) continue;
    let bucket: FollowUpItem["bucket"];
    if (r.f.status.startsWith("cancelled")) bucket = "cancelled";
    else if (r.f.status === "sent" || r.f.status === "completed") bucket = "completed";
    else bucket = classifyDue(r.f.dueAt, now) as FollowUpItem["bucket"];

    groups[bucket]!.push({
      id: r.f.id,
      leadId: r.f.leadId,
      businessName: r.lead.businessName,
      sequence: r.f.sequence,
      emailType: r.f.emailType,
      status: r.f.status,
      dueAt: r.f.dueAt.toISOString(),
      bucket,
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Follow-ups"
        description={`Nothing sends automatically. Follow-ups shown are for ${product?.name ?? "your selected product"}.`}
        actions={
          <>
            <CheckGmailButton />
            <PrepareFollowUpsButton />
          </>
        }
      />
      <FollowUpsClient groups={groups} />
    </div>
  );
}
