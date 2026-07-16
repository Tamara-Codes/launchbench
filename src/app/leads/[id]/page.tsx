import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  HelpCircle,
  Lightbulb,
  AlertTriangle,
  ExternalLink,
  Mail,
  Globe,
  Phone,
  MapPin,
} from "lucide-react";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import { LeadStatusBadge, DraftStatusBadge } from "@/components/status";
import { LeadEditForm, LeadQuickActions } from "@/components/lead-detail-client";
import { getLeadDetail } from "@/server/repo";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getLeadDetail(id);
  if (!detail) notFound();
  const { lead, sources, history, drafts, sent, followUps, dups } = detail;
  const facts = lead.facts;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/leads" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Back to leads
        </Link>
        <LeadEditForm
          lead={{
            id: lead.id,
            businessName: lead.businessName,
            email: lead.email,
            phone: lead.phone,
            website: lead.website,
            town: lead.town,
            settlement: lead.settlement,
            estimatedUnits: lead.estimatedUnits,
            notes: lead.notes,
            languagePreference: lead.languagePreference,
            status: lead.status,
          }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-strong">{lead.businessName}</h1>
        <LeadStatusBadge status={lead.status} />
        {lead.isInTargetLocation ? (
          <Badge tone="success">In territory</Badge>
        ) : (
          <Badge tone="warning">Location unconfirmed</Badge>
        )}
      </div>

      {dups.length > 0 && (
        <Card>
          <CardContent className="flex items-start gap-2 pt-5 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-warning" />
            <div>
              <p className="font-medium text-ink-strong">Possible duplicate ({dups.length})</p>
              {dups.map((d) => (
                <p key={d.id} className="text-muted">
                  {d.matchType} match ({Math.round(d.score * 100)}%) — {d.details}. Stored for manual review; not merged.
                </p>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Business information</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <Info icon={<Mail className="h-4 w-4" />} label="Email" value={lead.email || "—"} />
              <Info icon={<Phone className="h-4 w-4" />} label="Phone" value={lead.phone || "—"} />
              <Info
                icon={<Globe className="h-4 w-4" />}
                label="Website"
                value={lead.website ? <a href={lead.website} target="_blank" rel="noreferrer" className="text-accent hover:underline">{lead.domain || lead.website}</a> : "—"}
              />
              <Info icon={<MapPin className="h-4 w-4" />} label="Location" value={`${lead.settlement || lead.town}${lead.town && lead.settlement ? `, ${lead.town}` : ""}` || "—"} />
              <Info label="Accommodation type" value={lead.accommodationType || "—"} />
              <Info label="Estimated units" value={lead.estimatedUnits ?? "—"} />
              <Info label="Direct booking" value={lead.directBooking ? "Yes" : "No"} />
              <Info label="International guests" value={lead.internationalGuestsLikely ? "Likely" : "Unknown"} />
              <Info label="Existing digital guide" value={lead.existingDigitalGuideDetected ? "Detected" : "None detected"} />
              <Info label="Languages" value={facts.languages.join(", ") || "—"} />
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-3">
            <FactsCard title="Verified facts" icon={<CheckCircle2 className="h-4 w-4 text-success" />} items={facts.verifiedFacts} tone="success" />
            <FactsCard title="Inferred" icon={<Lightbulb className="h-4 w-4 text-warning" />} items={facts.inferredFacts} tone="warning" />
            <FactsCard title="Unknown" icon={<HelpCircle className="h-4 w-4 text-muted" />} items={facts.unknownFields} tone="neutral" />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Qualification reasoning</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase text-muted">Positive</p>
                {facts.qualificationReasons.length ? (
                  <ul className="list-inside list-disc space-y-0.5 text-ink">
                    {facts.qualificationReasons.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                ) : <p className="text-muted">—</p>}
              </div>
              {facts.rejectionReasons.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase text-muted">Concerns</p>
                  <ul className="list-inside list-disc space-y-0.5 text-danger">
                    {facts.rejectionReasons.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Source evidence ({sources.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {sources.length === 0 ? (
                <p className="text-sm text-muted">No source evidence stored.</p>
              ) : (
                sources.map((s) => (
                  <div key={s.id} className="rounded-lg border bg-surface2/40 p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-ink-strong">{s.field || "evidence"}</span>
                      {s.url && (
                        <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
                          <ExternalLink className="h-3 w-3" /> source
                        </a>
                      )}
                    </div>
                    {s.snippet && <p className="prose-evidence mt-1 text-muted">{s.snippet}</p>}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {lead.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent className="prose-evidence text-sm text-ink">{lead.notes}</CardContent>
            </Card>
          )}
        </div>

        {/* Side column */}
        <div className="space-y-6">
          <LeadQuickActions
            lead={{
              id: lead.id,
              businessName: lead.businessName,
              email: lead.email,
              phone: lead.phone,
              website: lead.website,
              town: lead.town,
              settlement: lead.settlement,
              estimatedUnits: lead.estimatedUnits,
              notes: lead.notes,
              languagePreference: lead.languagePreference,
              status: lead.status,
            }}
          />

          <Card>
            <CardHeader>
              <CardTitle>At a glance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Glance label="Lead score" value={`${lead.leadScore}/100`} />
              <Glance label="Confidence" value={`${Math.round(lead.confidence * 100)}%`} />
              <Glance label="Found" value={formatDate(lead.createdAt)} />
              <Glance label="Last contacted" value={formatDate(lead.lastContactedAt)} />
              <Glance label="Next follow-up" value={formatDate(lead.nextFollowUpAt)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Email history</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {drafts.length === 0 && sent.length === 0 ? (
                <p className="text-muted">No emails yet.</p>
              ) : (
                <>
                  {sent.map((e) => (
                    <div key={e.id} className="flex items-center justify-between border-b py-1.5 last:border-0">
                      <span className="text-ink">Sent · {e.emailType}</span>
                      <span className="text-xs text-muted">{formatDate(e.sentAt, true)}</span>
                    </div>
                  ))}
                  {drafts.map((d) => (
                    <div key={d.id} className="flex items-center justify-between border-b py-1.5 last:border-0">
                      <span className="text-ink">{d.emailType}</span>
                      <DraftStatusBadge status={d.status} />
                    </div>
                  ))}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Follow-ups</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {followUps.length === 0 ? (
                <p className="text-muted">None scheduled.</p>
              ) : (
                followUps.map((f) => (
                  <div key={f.id} className="flex items-center justify-between border-b py-1.5 last:border-0">
                    <span className="text-ink">
                      #{f.sequence} · {f.status}
                    </span>
                    <span className="text-xs text-muted">{formatDate(f.dueAt)}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Status history</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {history.map((h) => (
                <div key={h.id} className="border-b py-1.5 last:border-0">
                  <div className="flex items-center justify-between">
                    <span className="text-ink">{h.toStatus}</span>
                    <span className="text-xs text-muted">{formatDate(h.createdAt, true)}</span>
                  </div>
                  {h.reason && <p className="text-xs text-muted">{h.reason}</p>}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Info({ icon, label, value }: { icon?: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted">
        {icon}
        {label}
      </p>
      <p className="mt-0.5 text-sm text-ink">{value}</p>
    </div>
  );
}

function Glance({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b py-1.5 last:border-0">
      <span className="text-muted">{label}</span>
      <span className="font-medium text-ink-strong">{value}</span>
    </div>
  );
}

function FactsCard({
  title,
  icon,
  items,
  tone: _tone,
}: {
  title: string;
  icon: React.ReactNode;
  items: string[];
  tone: "success" | "warning" | "neutral";
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-1.5 text-xs">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-xs text-muted">—</p>
        ) : (
          <ul className="space-y-1 text-xs text-ink">
            {items.map((t, i) => (
              <li key={i}>• {t}</li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
