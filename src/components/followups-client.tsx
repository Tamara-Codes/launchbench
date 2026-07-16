"use client";
import Link from "next/link";
import { useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState } from "./ui";
import { toast } from "./toast";
import { generateFollowUp } from "@/server/actions";
import { formatDate } from "@/lib/utils";

export interface FollowUpItem {
  id: string;
  leadId: string;
  businessName: string;
  sequence: number;
  emailType: string;
  status: string;
  dueAt: string;
  bucket: "overdue" | "dueToday" | "upcoming" | "future" | "cancelled" | "completed";
}

const SECTION_TONE: Record<string, "danger" | "warning" | "info" | "neutral" | "success"> = {
  overdue: "danger",
  dueToday: "warning",
  upcoming: "info",
  future: "neutral",
  cancelled: "neutral",
  completed: "success",
};

export function FollowUpsClient({ groups }: { groups: Record<string, FollowUpItem[]> }) {
  const order: { key: string; label: string }[] = [
    { key: "overdue", label: "Overdue" },
    { key: "dueToday", label: "Due today" },
    { key: "upcoming", label: "Upcoming (7 days)" },
    { key: "future", label: "Later" },
    { key: "cancelled", label: "Cancelled" },
    { key: "completed", label: "Completed" },
  ];
  const hasAny = Object.values(groups).some((g) => g.length > 0);
  if (!hasAny) {
    return (
      <EmptyState
        icon={<Mail className="h-8 w-8" />}
        title="No follow-ups scheduled"
        description="Follow-ups are scheduled automatically after you send an initial email."
      />
    );
  }
  return (
    <div className="space-y-4">
      {order.map(({ key, label }) => {
        const items = groups[key] ?? [];
        if (items.length === 0) return null;
        return (
          <Card key={key}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {label} <Badge tone={SECTION_TONE[key]}>{items.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {items.map((f) => (
                <FollowUpRow key={f.id} item={f} actionable={key === "overdue" || key === "dueToday"} />
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function FollowUpRow({ item, actionable }: { item: FollowUpItem; actionable: boolean }) {
  const [busy, setBusy] = useState(false);

  async function gen() {
    setBusy(true);
    const res = await generateFollowUp(item.id);
    setBusy(false);
    if (res.ok) toast("Follow-up draft generated — review it in the Email Queue.", "success");
    else toast(res.error, "error");
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-surface2/40 p-3 text-sm">
      <div>
        <Link href={`/leads/${item.leadId}`} className="font-medium text-ink-strong hover:text-accent">
          {item.businessName}
        </Link>
        <p className="text-xs text-muted">
          #{item.sequence} · {item.emailType} · due {formatDate(item.dueAt)} · {item.status}
        </p>
      </div>
      {actionable && item.status !== "prepared" && (
        <Button size="sm" variant="secondary" onClick={gen} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} Generate draft
        </Button>
      )}
      {item.status === "prepared" && (
        <Link href="/email-queue">
          <Button size="sm" variant="outline">
            In queue
          </Button>
        </Link>
      )}
    </div>
  );
}
