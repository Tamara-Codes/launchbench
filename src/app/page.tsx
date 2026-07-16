import Link from "next/link";
import { ArrowRight, Search, MapPin, TrendingUp, Mail, Reply, Trophy, Activity, PenLine, CalendarDays } from "lucide-react";
import { hasSupabaseConfig } from "@/env";
import { getDailyLeadSeries, getDashboardData, leadStatusCounts } from "@/server/repo";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState, PageHeader, Progress } from "@/components/ui";
import { RunStatusBadge } from "@/components/status";
import { LeadsByDayChart } from "@/components/charts";
import { CheckGmailButton, PrepareFollowUpsButton } from "@/components/dashboard-actions";
import { formatDate, relativeTime } from "@/lib/utils";
import { getSelectedProduct } from "@/server/product-context";
import { MarketingPage } from "@/components/marketing-page";

export const dynamic = "force-dynamic";

const PIPELINE_STAGES: { key: string; label: string }[] = [
  { key: "awaitingReview", label: "Awaiting Review" },
  { key: "approved", label: "Approved" },
  { key: "contacted", label: "Contacted" },
  { key: "replied", label: "Replied" },
  { key: "interested", label: "Interested" },
  { key: "customer", label: "Customer" },
  { key: "notInterested", label: "Not Interested" },
];

function StatTile({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-ink-strong">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  if (hasSupabaseConfig() || process.env.MARKETING_PREVIEW === "true") return <MarketingPage />;
  const product = await getSelectedProduct();
  const data = await getDashboardData(product?.id);
  const territory = data.territory;
  const series = await getDailyLeadSeries(14, territory?.id, product?.id);
  const pipeline = territory ? await leadStatusCounts(territory.id, product?.id) : data.pipeline;

  const target = data.settings?.dailyLeadTarget ?? 10;
  const foundToday = data.qualifiedToday;
  const now = Date.now();
  const dueToday = data.followUps.filter((f) => f.dueAt.getTime() <= now).length;
  const upcoming = data.followUps.filter((f) => f.dueAt.getTime() > now).length;

  const awaitingReview = pipeline.awaitingReview ?? 0;
  const approved = pipeline.approved ?? 0;
  const contacted =
    (pipeline.contacted ?? 0) +
    (pipeline.followUpDue ?? 0) +
    (pipeline.replied ?? 0) +
    (pipeline.interested ?? 0) +
    (pipeline.customer ?? 0);
  const replied = (pipeline.replied ?? 0) + (pipeline.interested ?? 0) + (pipeline.customer ?? 0);
  const customers = pipeline.customer ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={`A shared view of customer outreach and social content for ${product?.name ?? "your selected product"}.`}
        actions={
          <>
            <CheckGmailButton />
            <PrepareFollowUpsButton />
            <Link href="/find-leads">
              <Button>
                <Search className="h-4 w-4" /> Find Today&apos;s Leads
              </Button>
            </Link>
            <Link href="/content-studio">
              <Button variant="outline"><PenLine className="h-4 w-4" /> Create content</Button>
            </Link>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Sales today</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3"><div><p className="text-2xl font-semibold text-ink-strong">{foundToday}</p><p className="text-xs text-muted">qualified leads today</p></div><div><p className="text-2xl font-semibold text-ink-strong">{dueToday}</p><p className="text-xs text-muted">follow-ups due</p></div></div>
            <Link href="/find-leads" className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">Find leads <ArrowRight className="h-3.5 w-3.5" /></Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Content today</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3"><div><p className="text-2xl font-semibold text-ink-strong">{data.social.readyForReview}</p><p className="text-xs text-muted">ready for review</p></div><div><p className="text-2xl font-semibold text-ink-strong">{data.social.scheduled}</p><p className="text-xs text-muted">upcoming posts</p></div></div>
            {data.social.next ? <p className="text-sm text-muted">Next: <span className="font-medium text-ink">{data.social.next.item.hook || data.social.next.item.contentType}</span>{data.social.next.product ? ` for ${data.social.next.product.name}` : ""}</p> : <p className="text-sm text-muted">No post is scheduled yet.</p>}
            <Link href="/content-calendar" className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">Open calendar <CalendarDays className="h-3.5 w-3.5" /></Link>
          </CardContent>
        </Card>
      </div>

      {/* 1. Territory header */}
      {territory ? (
        <Card>
          <CardContent className="flex flex-col gap-4 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-ink-strong">{territory.town}</h2>
                  <span className="text-sm text-muted">{territory.country}</span>
                  {territory.confirmedExhausted ? (
                    <Badge tone="danger">Confirmed exhausted</Badge>
                  ) : territory.possiblyExhausted ? (
                    <Badge tone="warning">Possibly exhausted</Badge>
                  ) : (
                    <Badge tone="success">Active</Badge>
                  )}
                </div>
                <p className="mt-0.5 text-sm text-muted">
                  Last searched {relativeTime(territory.lastSearchedAt)} ·{" "}
                  {territory.totalQualifiedLeads} qualified · {territory.totalContacted} contacted ·{" "}
                  {Math.max(0, territory.totalQualifiedLeads - territory.totalContacted)} uncontacted
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Link href="/find-leads">
                <Button variant="outline">Change territory</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          icon={<MapPin className="h-8 w-8" />}
          title="No active territory"
          description="Create and select a town to search on the Find Leads page."
          action={
            <Link href="/find-leads">
              <Button>Go to Find Leads</Button>
            </Link>
          }
        />
      )}

      {/* 2. Today's progress */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Today&apos;s discovery</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-end justify-between">
              <span className="text-3xl font-semibold text-ink-strong">{foundToday}</span>
              <span className="text-sm text-muted">of {target} target</span>
            </div>
            <Progress value={(foundToday / target) * 100} />
            <p className="text-sm text-muted">
              {foundToday} of {target} qualified leads found today
            </p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-4 lg:col-span-2">
          <StatTile label="Awaiting review" value={awaitingReview} hint="Needs your decision" />
          <StatTile label="Approved, not contacted" value={approved} />
          <StatTile label="Emails sent today" value={data.emailsSentToday} />
          <StatTile label="Follow-ups due" value={dueToday} hint={`${upcoming} upcoming`} />
        </div>
      </div>

      {/* 3. Sales pipeline */}
      <Card>
        <CardHeader>
          <CardTitle>Sales pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {PIPELINE_STAGES.map((s) => (
              <Link
                key={s.key}
                href={`/leads?status=${s.key}`}
                className="group rounded-lg border bg-surface2/40 p-3 transition-colors hover:border-accent hover:bg-accent-soft"
              >
                <div className="text-2xl font-semibold text-ink-strong">{pipeline[s.key] ?? 0}</div>
                <div className="mt-1 text-xs font-medium text-muted group-hover:text-accent">{s.label}</div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* 5. Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Qualified leads · last 14 days</CardTitle>
          </CardHeader>
          <CardContent>
            <LeadsByDayChart data={series} />
          </CardContent>
        </Card>

        {/* 4 + follow-up overview */}
        <Card>
          <CardHeader>
            <CardTitle>Follow-up overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Due today / overdue" value={dueToday} icon={<Mail className="h-4 w-4 text-warning" />} />
            <Row label="Upcoming (next 7d)" value={upcoming} icon={<Activity className="h-4 w-4 text-info" />} />
            <Row label="Replies (open)" value={replied} icon={<Reply className="h-4 w-4 text-success" />} />
            <Row label="Customers won" value={customers} icon={<Trophy className="h-4 w-4 text-success" />} />
            <div className="pt-2">
              <PrepareFollowUpsButton variant="secondary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Outreach effectiveness + recent run */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Outreach effectiveness</CardTitle>
          </CardHeader>
          <CardContent>
            {contacted === 0 ? (
              <EmptyState
                icon={<TrendingUp className="h-7 w-7" />}
                title="No outreach yet"
                description="Reply and conversion rates appear once you've contacted leads."
              />
            ) : (
              <div className="space-y-2 text-sm">
                <Row label="Contacted" value={contacted} />
                <Row label="Reply rate" value={`${Math.round((replied / contacted) * 100)}%`} />
                <Row label="Interested" value={pipeline.interested ?? 0} />
                <Row
                  label="Contacted → customer"
                  value={`${contacted ? Math.round((customers / contacted) * 100) : 0}%`}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Most recent search run</CardTitle>
          </CardHeader>
          <CardContent>
            {data.lastRun ? (
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <RunStatusBadge status={data.lastRun.status} />
                  <span className="text-muted">{relativeTime(data.lastRun.createdAt)}</span>
                </div>
                <Row label="Qualified" value={data.lastRun.stats.qualifiedLeads} />
                <Row label="Candidates" value={data.lastRun.stats.candidatesDiscovered} />
                <Row label="Duplicates" value={data.lastRun.stats.duplicatesFound} />
                <Link href={`/search-history/${data.lastRun.id}`} className="inline-flex items-center gap-1 text-sm text-accent hover:underline">
                  View run <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ) : (
              <EmptyState icon={<Search className="h-7 w-7" />} title="No runs yet" description="Start your first lead search." />
            )}
          </CardContent>
        </Card>

        {/* 6. Recent activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            {data.activity.length === 0 ? (
              <EmptyState icon={<Activity className="h-7 w-7" />} title="No activity yet" />
            ) : (
              <ul className="space-y-2.5">
                {data.activity.map((a) => (
                  <li key={a.id} className="flex items-start gap-2 text-sm">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    <div className="min-w-0">
                      <p className="truncate text-ink">{a.message}</p>
                      <p className="text-xs text-muted">{formatDate(a.createdAt, true)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b py-1.5 last:border-0">
      <span className="flex items-center gap-2 text-muted">
        {icon}
        {label}
      </span>
      <span className="font-medium text-ink-strong">{value}</span>
    </div>
  );
}
