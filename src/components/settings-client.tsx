"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Mail,
  Clock,
  FileText,
  MapPin,
  Plug,
  Database,
  Loader2,
  Download,
  Save,
  Check,
} from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Textarea } from "./ui";
import { toast } from "./toast";
import {
  activateTerritory,
  connectGmail,
  createBackup,
  disconnectGmail,
  refreshGmailStatus,
  setTerritoryExhaustion,
  updateFollowUpRules,
  updateSettings,
  updateTemplate,
} from "@/server/actions";
import { cn, formatDate } from "@/lib/utils";

const TABS = [
  { key: "sender", label: "Sender & general", icon: Mail },
  { key: "followups", label: "Follow-up rules", icon: Clock },
  { key: "templates", label: "Email templates", icon: FileText },
  { key: "territories", label: "Territories", icon: MapPin },
  { key: "gmail", label: "Gmail", icon: Plug },
  { key: "data", label: "Data & backup", icon: Database },
] as const;

export function SettingsClient({ data }: { data: any }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("sender");
  return (
    <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
      <nav className="flex gap-1 overflow-x-auto lg:flex-col">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium",
                tab === t.key ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface2 hover:text-ink",
              )}
            >
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </nav>
      <div>
        {tab === "sender" && <SenderForm settings={data.settings} />}
        {tab === "followups" && <FollowUpForm rules={data.rules} />}
        {tab === "templates" && <TemplatesEditor templates={data.templates} />}
        {tab === "territories" && <TerritoriesPanel territories={data.territories} />}
        {tab === "gmail" && <GmailPanel conn={data.gmail} configured={data.composioConfigured} />}
        {tab === "data" && <DataPanel stats={data.dataStats} />}
      </div>
    </div>
  );
}


function useSaver() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  async function save(fn: () => Promise<{ ok: boolean; error?: string }>, msg = "Saved.") {
    setSaving(true);
    const res = await fn();
    setSaving(false);
    if (res.ok) {
      toast(msg, "success");
      router.refresh();
    } else toast(res.error ?? "Error", "error");
  }
  return { saving, save };
}

function SenderForm({ settings }: { settings: any }) {
  const { saving, save } = useSaver();
  const [f, setF] = useState({
    senderName: settings?.senderName ?? "",
    senderCompany: settings?.senderCompany ?? "",
    senderEmail: settings?.senderEmail ?? "",
    senderSignature: settings?.senderSignature ?? "",
    dailyLeadTarget: settings?.dailyLeadTarget ?? 10,
  });
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-success">Sender identity & general</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <TextField label="Sender name" value={f.senderName} onChange={(v) => set("senderName", v)} />
        <TextField label="Sender company" value={f.senderCompany} onChange={(v) => set("senderCompany", v)} />
        <TextField label="Default sending email" value={f.senderEmail} onChange={(v) => set("senderEmail", v)} />
        <div className="space-y-1.5">
          <Label>Daily lead target</Label>
          <Input type="number" value={f.dailyLeadTarget} onChange={(e) => set("dailyLeadTarget", Number(e.target.value) || 10)} />
        </div>
        <AreaField className="sm:col-span-2" label="Email signature" value={f.senderSignature} onChange={(v) => set("senderSignature", v)} />
        <div className="sm:col-span-2">
          <Button disabled={saving} onClick={() => save(() => updateSettings(f))}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function FollowUpForm({ rules }: { rules: any }) {
  const { saving, save } = useSaver();
  const [f, setF] = useState({
    firstFollowUpDays: rules?.firstFollowUpDays ?? 4,
    finalFollowUpDays: rules?.finalFollowUpDays ?? 7,
    maxFollowUps: rules?.maxFollowUps ?? 2,
    stopAfterReply: rules?.stopAfterReply ?? true,
    stopAfterOptOut: rules?.stopAfterOptOut ?? true,
    stopAfterInvalidAddress: rules?.stopAfterInvalidAddress ?? true,
    stopAfterNotInterested: rules?.stopAfterNotInterested ?? true,
  });
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));
  const toggles: [string, string][] = [
    ["stopAfterReply", "Stop after any reply"],
    ["stopAfterOptOut", "Stop after opt-out"],
    ["stopAfterInvalidAddress", "Stop after invalid address"],
    ["stopAfterNotInterested", "Stop after marked not interested"],
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-success">Follow-up rules</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>First follow-up (days)</Label>
            <Input type="number" value={f.firstFollowUpDays} onChange={(e) => set("firstFollowUpDays", Number(e.target.value) || 1)} />
          </div>
          <div className="space-y-1.5">
            <Label>Final follow-up (days after first)</Label>
            <Input type="number" value={f.finalFollowUpDays} onChange={(e) => set("finalFollowUpDays", Number(e.target.value) || 1)} />
          </div>
          <div className="space-y-1.5">
            <Label>Max follow-ups</Label>
            <Input type="number" value={f.maxFollowUps} onChange={(e) => set("maxFollowUps", Number(e.target.value) || 0)} />
          </div>
        </div>
        <div className="space-y-2">
          {toggles.map(([k, label]) => (
            <label key={k} className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={(f as any)[k]} onChange={(e) => set(k, e.target.checked)} />
              {label}
            </label>
          ))}
        </div>
        <Button disabled={saving} onClick={() => save(() => updateFollowUpRules(f))}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save rules
        </Button>
      </CardContent>
    </Card>
  );
}

function TemplatesEditor({ templates }: { templates: any[] }) {
  const croatianTemplates = templates.filter((template) => template.language === "hr");
  const [selId, setSelId] = useState(croatianTemplates[0]?.id ?? "");
  const sel = croatianTemplates.find((t) => t.id === selId);
  const { saving, save } = useSaver();
  const [subject, setSubject] = useState(sel?.subject ?? "");
  const [body, setBody] = useState(sel?.body ?? "");

  function pick(id: string) {
    const t = croatianTemplates.find((x) => x.id === id);
    setSelId(id);
    setSubject(t?.subject ?? "");
    setBody(t?.body ?? "");
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-1 lg:col-span-1">
        {croatianTemplates.map((t) => (
          <button
            key={t.id}
            onClick={() => pick(t.id)}
            className={cn(
              "w-full rounded-lg border p-2.5 text-left text-sm",
              selId === t.id ? "border-accent bg-accent-soft/50" : "hover:bg-surface2",
            )}
          >
            <span className="font-medium text-ink-strong">{t.name}</span>
            <span className="ml-2 text-xs uppercase text-muted">{t.language}</span>
          </button>
        ))}
      </div>
      <div className="lg:col-span-2">
        {sel ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-success">{sel.name} · v{sel.version}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted">
                Variables: {"{{business_name}} {{town}} {{product_name}} {{sender_name}} {{sender_company}} {{demo_url}} {{website_url}} {{price_text}} {{verified_observation}}"}
              </p>
              <div className="space-y-1.5">
                <Label>Subject</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Body</Label>
                <Textarea rows={12} value={body} onChange={(e) => setBody(e.target.value)} className="font-mono text-xs" />
              </div>
              <Button disabled={saving} onClick={() => save(() => updateTemplate(sel.id, { subject, body, active: true }))}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save template (new version)
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card><CardContent className="py-10 text-muted">No templates. Run db:seed.</CardContent></Card>
        )}
      </div>
    </div>
  );
}

function TerritoriesPanel({ territories }: { territories: any[] }) {
  const { save } = useSaver();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-success">Territories</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {territories.map((t) => (
          <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
            <div>
              <span className="font-medium text-ink-strong">{t.town}, {t.country}</span>
              <div className="mt-1 flex gap-1.5">
                {t.active && <Badge tone="accent">Active</Badge>}
                {t.confirmedExhausted ? (
                  <Badge tone="danger">Confirmed exhausted</Badge>
                ) : t.possiblyExhausted ? (
                  <Badge tone="warning">Possibly exhausted</Badge>
                ) : null}
                <span className="text-xs text-muted">
                  {t.totalQualifiedLeads} leads · {t.totalContacted} contacted
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              {!t.active && (
                <Button size="sm" variant="secondary" onClick={() => save(() => activateTerritory(t.id), "Territory activated.")}>
                  Activate
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => save(() => setTerritoryExhaustion(t.id, !t.confirmedExhausted), "Updated.")}
              >
                {t.confirmedExhausted ? "Unmark exhausted" : "Confirm exhausted"}
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function GmailPanel({ conn, configured }: { conn: any; configured: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const status = conn?.status ?? "disconnected";
  const isConnected = status === "active";
  const isConnecting = status === "initiated";

  useEffect(() => {
    if (!isConnecting) return;

    let cancelled = false;
    const poll = async () => {
      const res = await refreshGmailStatus();
      if (!cancelled && res.ok && res.data?.status !== "initiated") router.refresh();
    };

    void poll();
    const interval = window.setInterval(() => void poll(), 3000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [isConnecting, router]);

  async function run(name: string, fn: () => Promise<any>) {
    setBusy(name);
    const res = await fn();
    setBusy(null);
    if (res.ok) {
      if (name === "connect" && res.data?.redirectUrl) {
        window.open(res.data.redirectUrl, "_blank");
        router.refresh();
        toast("Complete Gmail authorization in the new tab.", "info");
      } else {
        toast("Done.", "success");
        router.refresh();
      }
    } else toast(res.error, "error");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-success">Gmail connection (via Composio)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!configured && (
          <p className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">
            Set COMPOSIO_API_KEY and COMPOSIO_AUTH_CONFIG_ID in .env.local, then restart the app.
          </p>
        )}
        {isConnected ? (
          <div className="flex flex-col justify-between gap-3 rounded-lg bg-success-soft p-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success text-accent-fg">
                <Check className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-ink-strong">Gmail connected</p>
                <p className="text-xs text-muted">{conn?.accountEmail || "Ready to create drafts, send emails, and check replies."}</p>
              </div>
            </div>
            <Button variant="ghost" disabled={!!busy} onClick={() => run("disconnect", disconnectGmail)}>
              Disconnect Gmail
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button disabled={!configured || isConnecting || !!busy} onClick={() => run("connect", connectGmail)}>
              {busy === "connect" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
              {isConnecting ? "Connecting Gmail…" : "Connect Gmail"}
            </Button>
            {conn?.connectedAccountId && (
              <Button variant="ghost" disabled={!!busy} onClick={() => run("disconnect", disconnectGmail)}>
                Disconnect Gmail
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DataPanel({ stats }: { stats: any }) {
  const { save } = useSaver();
  const sizeMb = (stats.sizeBytes / (1024 * 1024)).toFixed(2);
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-success">Database</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-sm">
          <Row label="File location" value={<code className="text-xs">{stats.dbFilePath}</code>} />
          <Row label="File size" value={`${sizeMb} MB`} />
          <Row label="Total leads" value={stats.totalLeads} />
          <Row label="Total search runs" value={stats.totalRuns} />
          <Row label="Total sent emails" value={stats.totalSent} />
          <Row label="Last backup" value={stats.lastBackupAt ? formatDate(stats.lastBackupAt, true) : "Never"} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-success">Backup & export</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button onClick={() => save(() => createBackup(), "Backup created in /backups.")}>
            <Database className="h-4 w-4" /> Create backup
          </Button>
          <a href="/api/export?type=leads-csv" download>
            <Button variant="outline"><Download className="h-4 w-4" /> Leads CSV</Button>
          </a>
          <a href="/api/export?type=leads-json" download>
            <Button variant="outline"><Download className="h-4 w-4" /> Leads JSON</Button>
          </a>
          <a href="/api/export?type=all-json" download>
            <Button variant="outline"><Download className="h-4 w-4" /> All data JSON</Button>
          </a>
        </CardContent>
      </Card>
    </div>
  );
}

// --- small field helpers ---
function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
function AreaField({ label, value, onChange, className }: { label: string; value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label>{label}</Label>
      <Textarea rows={3} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b py-1.5 last:border-0">
      <span className="text-muted">{label}</span>
      <span className="font-medium text-ink-strong">{value}</span>
    </div>
  );
}
