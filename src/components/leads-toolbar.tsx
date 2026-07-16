"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Search, Loader2 } from "lucide-react";
import { Button, Card, CardContent, Input, Label } from "./ui";
import { Select } from "./ui-select";
import { toast } from "./toast";
import { createLead } from "@/server/actions";

const STATUSES = [
  "",
  "awaitingReview",
  "approved",
  "contacted",
  "replied",
  "interested",
  "customer",
  "notInterested",
  "rejected",
  "optedOut",
  "duplicate",
  "invalidContact",
];

export function LeadsToolbar({
  territories,
  activeTerritoryId,
}: {
  territories: { id: string; town: string }[];
  activeTerritoryId: string | null;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [showCreate, setShowCreate] = useState(false);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/leads?${next.toString()}`);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted" />
          <Input
            placeholder="Search business, email, town…"
            defaultValue={params.get("q") ?? ""}
            className="w-64 pl-8"
            onKeyDown={(e) => {
              if (e.key === "Enter") setParam("q", (e.target as HTMLInputElement).value);
            }}
          />
        </div>
        <Select value={params.get("status") ?? ""} onChange={(e) => setParam("status", e.target.value)} className="w-48">
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s === "" ? "All statuses" : s}
            </option>
          ))}
        </Select>
        <Select value={params.get("territoryId") ?? ""} onChange={(e) => setParam("territoryId", e.target.value)} className="w-48">
          <option value="">All territories</option>
          {territories.map((t) => (
            <option key={t.id} value={t.id}>
              {t.town}
            </option>
          ))}
        </Select>
        <Select value={params.get("hasEmail") ?? ""} onChange={(e) => setParam("hasEmail", e.target.value)} className="w-40">
          <option value="">Any contact</option>
          <option value="1">Has email</option>
        </Select>
        <div className="ml-auto">
          <Button variant="outline" onClick={() => setShowCreate((s) => !s)}>
            <Plus className="h-4 w-4" /> Add lead
          </Button>
        </div>
      </div>

      {showCreate && (
        <CreateLeadForm
          territories={territories}
          defaultTerritory={activeTerritoryId}
          onDone={() => {
            setShowCreate(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function CreateLeadForm({
  territories,
  defaultTerritory,
  onDone,
}: {
  territories: { id: string; town: string }[];
  defaultTerritory: string | null;
  onDone: () => void;
}) {
  const [territoryId, setTerritoryId] = useState(defaultTerritory ?? territories[0]?.id ?? "");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [town, setTown] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!businessName.trim()) return toast("Business name is required.", "error");
    setSaving(true);
    const res = await createLead({
      territoryId,
      businessName: businessName.trim(),
      email: email.trim(),
      website: website.trim(),
      town: town.trim(),
      phone: "",
      estimatedUnits: null,
    });
    setSaving(false);
    if (res.ok) {
      toast("Lead created.", "success");
      onDone();
    } else toast(res.error, "error");
  }

  return (
    <Card>
      <CardContent className="grid gap-3 pt-5 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Territory</Label>
          <Select value={territoryId} onChange={(e) => setTerritoryId(e.target.value)}>
            {territories.map((t) => (
              <option key={t.id} value={t.id}>
                {t.town}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Business name</Label>
          <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Website</Label>
          <Input value={website} onChange={(e) => setWebsite(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Town</Label>
          <Input value={town} onChange={(e) => setTown(e.target.value)} />
        </div>
        <div className="flex items-end">
          <Button className="w-full" onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create lead
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
