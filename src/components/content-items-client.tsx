"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  List,
  Loader2,
  Trash2,
} from "lucide-react";
import { Badge, Button, Card, CardContent, EmptyState } from "./ui";
import { Select } from "./ui-select";
import { toast } from "./toast";
import {
  archiveSocialContent,
  deleteSocialContent,
  duplicateSocialContent,
  markSocialContentPosted,
  scheduleSocialContent,
} from "@/server/actions";
import { formatDate } from "@/lib/utils";

export interface SocialContentItem {
  id: string;
  productId: string;
  productName: string;
  contentType: string;
  hook: string;
  caption: string;
  cta: string;
  format: string;
  language: string;
  status: string;
  scheduledFor: string | null;
  postedAt: string | null;
  createdAt: string;
}

export interface ContentProduct {
  id: string;
  name: string;
}

const STATUS_TONE: Record<string, "neutral" | "accent" | "success" | "warning" | "danger" | "info"> = {
  idea: "neutral",
  generated: "info",
  approved: "accent",
  scheduled: "warning",
  posted: "success",
  skipped: "neutral",
  archived: "danger",
};

const STATUS_LABEL: Record<string, string> = {
  idea: "Idea",
  generated: "Generated",
  approved: "Approved",
  scheduled: "Scheduled",
  posted: "Posted",
  skipped: "Skipped",
  archived: "Archived",
};

const HISTORY_STATUSES = new Set(["posted", "skipped", "archived"]);

function itemTitle(item: SocialContentItem) {
  return item.hook || item.contentType || "Untitled post";
}

function dateInputValue(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function ContentItemsClient({
  items,
  products,
  page,
  selectedProductId,
}: {
  items: SocialContentItem[];
  products: ContentProduct[];
  page: "calendar" | "history";
  selectedProductId?: string | null;
}) {
  const router = useRouter();
  const [productId, setProductId] = useState(selectedProductId ?? "all");
  const [status, setStatus] = useState("all");
  const [view, setView] = useState<"calendar" | "list">(page === "calendar" ? "calendar" : "list");
  const [month, setMonth] = useState(() => new Date());

  const filtered = useMemo(() => {
    const scoped = page === "history" ? items.filter((item) => HISTORY_STATUSES.has(item.status)) : items.filter((item) => item.status !== "archived");
    return scoped.filter(
      (item) =>
        (productId === "all" || item.productId === productId) &&
        (status === "all" || item.status === status),
    );
  }, [items, page, productId, status]);

  const heading = page === "calendar" ? "Content Calendar" : "Content History";
  const description = page === "calendar"
    ? "Plan upcoming posts, adjust publishing times, and move finished work into history."
    : "Review what has been posted, skipped, or archived across products.";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink-strong">{heading}</h1>
          <p className="mt-0.5 text-sm text-muted">{description}</p>
        </div>
        {page === "calendar" && (
          <div className="flex rounded-lg border bg-surface p-1">
            <Button size="sm" variant={view === "calendar" ? "secondary" : "ghost"} onClick={() => setView("calendar")}>
              <CalendarDays className="h-4 w-4" /> Calendar
            </Button>
            <Button size="sm" variant={view === "list" ? "secondary" : "ghost"} onClick={() => setView("list")}>
              <List className="h-4 w-4" /> List
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardContent className="grid gap-3 pt-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted">Product</label>
            <Select value={productId} onChange={(event) => setProductId(event.target.value)}>
              <option value="all">All products</option>
              {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted">Status</label>
            <Select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">All statuses</option>
              {(page === "history" ? ["posted", "skipped", "archived"] : ["idea", "generated", "approved", "scheduled", "posted", "skipped"]).map((value) => (
                <option key={value} value={value}>{STATUS_LABEL[value]}</option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="h-8 w-8" />}
          title={page === "calendar" ? "No content is scheduled here" : "No content history yet"}
          description={page === "calendar" ? "Create or schedule content in Content Studio to populate your calendar." : "Mark a content item posted, skipped, or archived to keep a record here."}
        />
      ) : view === "calendar" ? (
        <CalendarView items={filtered} month={month} onMonthChange={setMonth} onChanged={() => router.refresh()} />
      ) : (
        <ListView items={filtered} onChanged={() => router.refresh()} />
      )}
    </div>
  );
}

function CalendarView({ items, month, onMonthChange, onChanged }: { items: SocialContentItem[]; month: Date; onMonthChange: (date: Date) => void; onChanged: () => void }) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const cells = Array.from({ length: first.getDay() + last.getDate() }, (_, index) => index < first.getDay() ? null : new Date(month.getFullYear(), month.getMonth(), index - first.getDay() + 1));
  const datedItems = items.filter((item) => item.scheduledFor).map((item) => ({ item, date: new Date(item.scheduledFor!) }));

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="mb-4 flex items-center justify-between">
          <Button size="icon" variant="ghost" aria-label="Previous month" onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft className="h-4 w-4" /></Button>
          <p className="font-semibold text-ink-strong">{month.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</p>
          <Button size="icon" variant="ghost" aria-label="Next month" onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <div className="grid grid-cols-7 border-l border-t">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <div key={day} className="border-b border-r bg-surface2 px-2 py-2 text-center text-xs font-medium text-muted">{day}</div>)}
          {cells.map((date, index) => (
            <div key={date?.toISOString() ?? `empty-${index}`} className="min-h-28 border-b border-r p-1.5 sm:min-h-32">
              {date && <>
                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${isSameDay(date, new Date()) ? "bg-accent text-accent-fg" : "text-muted"}`}>{date.getDate()}</span>
                <div className="mt-1 space-y-1">
                  {datedItems.filter(({ date: itemDate }) => isSameDay(itemDate, date)).map(({ item }) => (
                    <CalendarItem key={item.id} item={item} onChanged={onChanged} />
                  ))}
                </div>
              </>}
            </div>
          ))}
        </div>
        {items.some((item) => !item.scheduledFor) && <p className="mt-3 text-xs text-muted">{items.filter((item) => !item.scheduledFor).length} item(s) have no scheduled time yet; switch to list view to schedule them.</p>}
      </CardContent>
    </Card>
  );
}

function CalendarItem({ item, onChanged }: { item: SocialContentItem; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  return <>
    <button onClick={() => setOpen(true)} className="block w-full truncate rounded bg-accent-soft px-1.5 py-1 text-left text-[11px] font-medium text-accent hover:opacity-80" title={itemTitle(item)}>{itemTitle(item)}</button>
    {open && <ContentActionCard item={item} compact onClose={() => setOpen(false)} onChanged={onChanged} />}
  </>;
}

function ListView({ items, onChanged }: { items: SocialContentItem[]; onChanged: () => void }) {
  return <div className="space-y-3">{items.map((item) => <ContentActionCard key={item.id} item={item} onChanged={onChanged} />)}</div>;
}

function ContentActionCard({ item, onChanged, compact = false, onClose }: { item: SocialContentItem; onChanged: () => void; compact?: boolean; onClose?: () => void }) {
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduledFor, setScheduledFor] = useState(dateInputValue(item.scheduledFor));
  const [busy, setBusy] = useState<string | null>(null);

  async function run(name: string, work: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    setBusy(name);
    const result = await work();
    setBusy(null);
    if (result.ok) {
      toast(success, "success");
      onClose?.();
      onChanged();
    } else toast(result.error ?? "Unable to update content.", "error");
  }

  return (
    <Card className={compact ? "fixed inset-x-4 top-24 z-20 mx-auto max-w-xl shadow-lg" : ""}>
      <CardContent className="space-y-3 pt-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-ink-strong">{itemTitle(item)}</p>
              <Badge tone={STATUS_TONE[item.status] ?? "neutral"}>{STATUS_LABEL[item.status] ?? item.status}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted">{item.productName} · {item.format.replaceAll("_", " ")} · {item.language.toUpperCase()}</p>
          </div>
          {onClose && <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>}
        </div>
        {item.caption && <p className="line-clamp-2 text-sm text-ink">{item.caption}</p>}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
          <span className="flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> {item.scheduledFor ? `Scheduled ${formatDate(item.scheduledFor, true)}` : `Created ${formatDate(item.createdAt)}`}</span>
          {item.postedAt && <span>Posted {formatDate(item.postedAt, true)}</span>}
        </div>
        {scheduleOpen && (
          <div className="flex flex-col gap-2 rounded-lg bg-surface2 p-3 sm:flex-row sm:items-end">
            <label className="flex-1 text-xs font-medium text-muted">Publish date and time
              <input type="datetime-local" value={scheduledFor} onChange={(event) => setScheduledFor(event.target.value)} className="mt-1 h-9 w-full rounded-lg border bg-surface px-3 text-sm text-ink" />
            </label>
            <Button size="sm" disabled={!scheduledFor || !!busy} onClick={() => run("schedule", () => scheduleSocialContent(item.id, scheduledFor), item.scheduledFor ? "Schedule updated." : "Content scheduled.")}>{busy === "schedule" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarDays className="h-4 w-4" />} Save</Button>
          </div>
        )}
        <div className="flex flex-wrap gap-2 border-t pt-3">
          {item.status !== "posted" && item.status !== "archived" && <Button size="sm" variant="outline" disabled={!!busy} onClick={() => setScheduleOpen((value) => !value)}><CalendarDays className="h-4 w-4" /> {item.scheduledFor ? "Reschedule" : "Schedule"}</Button>}
          {item.status !== "posted" && item.status !== "archived" && <Button size="sm" variant="success" disabled={!!busy} onClick={() => run("posted", () => markSocialContentPosted(item.id), "Marked as posted.")}><Check className="h-4 w-4" /> Mark posted</Button>}
          <Button size="sm" variant="outline" disabled={!!busy} onClick={() => run("duplicate", () => duplicateSocialContent(item.id), "Duplicated as a new idea.")}><Copy className="h-4 w-4" /> Duplicate</Button>
          {item.status !== "archived" && <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => run("archive", () => archiveSocialContent(item.id), "Archived.")}><Archive className="h-4 w-4" /> Archive</Button>}
          <Button size="sm" variant="ghost" className="text-danger hover:text-danger" disabled={!!busy} onClick={() => { if (window.confirm("Delete this content item permanently?")) run("delete", () => deleteSocialContent(item.id), "Deleted."); }}><Trash2 className="h-4 w-4" /> Delete</Button>
        </div>
      </CardContent>
    </Card>
  );
}
