"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { requestTenantJob } from "@/server/tenant-job-actions";
import { createTenantTerritory } from "@/server/tenant-sales-actions";
import { Button, Input, Label, Select } from "./ui";

type Product = { id: string; name: string };
type Territory = { id: string; product_id: string; town: string; country: string };

export function TenantSalesPanel({ products, territories }: { products: Product[]; territories: Territory[] }) {
  const router = useRouter(); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function createTerritory(formData: FormData) {
    setBusy(true); setError("");
    const result = await createTenantTerritory(Object.fromEntries(formData)); setBusy(false);
    if (!result.ok) setError(result.error); else router.refresh();
  }
  async function runSales(formData: FormData) {
    setBusy(true); setError("");
    const result = await requestTenantJob({ kind: "lead_search", productId: String(formData.get("productId")), input: { territoryId: String(formData.get("territoryId")), targetLeads: Number(formData.get("targetLeads") || 10), maxQueries: 8, maxCandidates: 40, maxPagesPerCandidate: 3 } });
    setBusy(false); if (!result.ok) setError(result.error); else router.refresh();
  }
  return <div className="grid gap-6 lg:grid-cols-2">{error && <p className="text-sm text-danger lg:col-span-2" role="alert">{error}</p>}
    <form action={createTerritory} className="space-y-3 rounded-xl border p-5"><h2 className="font-semibold">Add territory</h2><label><Label>Product</Label><Select name="productId" required defaultValue=""><option value="" disabled>Select product</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></label><label><Label>Town</Label><Input name="town" required placeholder="Malinska" /></label><label><Label>Country</Label><Input name="country" defaultValue="Croatia" required /></label><label><Label>Included settlements</Label><Input name="includedSettlements" placeholder="Comma-separated, optional" /></label><label><Label>Excluded settlements</Label><Input name="excludedSettlements" placeholder="Comma-separated, optional" /></label><Button disabled={busy || !products.length}>{busy ? "Saving…" : "Save territory"}</Button></form>
    <form action={runSales} className="space-y-3 rounded-xl border p-5"><h2 className="font-semibold">Run Sales Agent</h2><p className="text-sm text-muted">The agent searches only within the selected territory and saves evidence-backed leads for review.</p><label><Label>Territory</Label><Select name="territoryId" required defaultValue=""><option value="" disabled>Select territory</option>{territories.map((t) => <option key={t.id} value={t.id}>{t.town}, {t.country}</option>)}</Select></label><label><Label>Product</Label><Select name="productId" required defaultValue=""><option value="" disabled>Select product</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></label><label><Label>Target qualified leads</Label><Input name="targetLeads" type="number" min="1" max="50" defaultValue="10" required /></label><Button disabled={busy || !territories.length}>{busy ? "Queueing…" : "Queue Sales Agent"}</Button></form></div>;
}
