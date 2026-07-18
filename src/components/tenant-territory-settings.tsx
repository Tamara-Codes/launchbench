"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Search } from "lucide-react";
import { createGlobalTenantTerritory } from "@/server/tenant-sales-actions";
import { Button, Input } from "./ui";

type Territory = { id: string; town: string; country: string; active: boolean };
type Suggestion = { placeId: string; label: string };

export function TenantTerritorySettings({ territories, hasProducts }: { territories: Territory[]; hasProducts: boolean }) {
  const [query, setQuery] = useState(""); const [suggestions, setSuggestions] = useState<Suggestion[]>([]); const [selected, setSelected] = useState<Suggestion | null>(null); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (selected || query.trim().length < 2) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try { const response = await fetch(`/api/places/autocomplete?input=${encodeURIComponent(query)}`, { signal: controller.signal }); const data = await response.json() as { suggestions?: Suggestion[]; error?: string }; setSuggestions(data.suggestions ?? []); if (data.error) setMessage(data.error); }
      catch (error) { if ((error as Error).name !== "AbortError") setMessage("Could not search places right now."); }
    }, 250);
    return () => { controller.abort(); window.clearTimeout(timeout); };
  }, [query, selected]);
  async function addTerritory() {
    if (!selected) { setMessage("Choose a place from the list first."); return; }
    setBusy(true); setMessage(""); const result = await createGlobalTenantTerritory({ placeId: selected.placeId }); setBusy(false);
    if (!result.ok) { setMessage(result.error); return; }
    setMessage(`${result.data.town}, ${result.data.country} is now available across this workspace.`); setQuery(""); setSelected(null); window.location.reload();
  }
  return <div className="space-y-6"><div className="rounded-lg border bg-surface2 p-4"><p className="text-sm font-medium text-ink">Add a territory</p><p className="mt-1 text-sm text-muted">This will be used by the Sales Agent to find leads.</p><div className="relative mt-4"><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><Input ref={inputRef} value={query} onChange={(event) => { setQuery(event.target.value); setSelected(null); setMessage(""); }} onFocus={() => selected && setSelected(null)} placeholder="Search a town, city, or region" className="pl-9" aria-autocomplete="list" aria-expanded={!selected && query.trim().length >= 2 && suggestions.length > 0} /></div>{!selected && query.trim().length >= 2 && suggestions.length > 0 && <div className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border bg-surface p-1 shadow-lg">{suggestions.map((suggestion) => <button key={suggestion.placeId} type="button" onClick={() => { setSelected(suggestion); setQuery(suggestion.label); setSuggestions([]); }} className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm text-ink hover:bg-surface2"><MapPin className="h-4 w-4 shrink-0 text-accent" />{suggestion.label}</button>)}</div>}</div><div className="mt-3 flex flex-wrap items-center gap-3"><Button disabled={busy || !selected || !hasProducts} onClick={addTerritory}>{busy ? "Adding…" : "Add territory"}</Button>{selected && <span className="text-sm text-muted">Selected: {selected.label}</span>}</div>{!hasProducts && <p className="mt-3 text-sm text-danger">Create a project before adding a territory.</p>}{message && <p className="mt-3 text-sm text-muted" role="status">{message}</p>}</div><div className="space-y-2">{territories.map((territory) => <div key={territory.id} className="flex items-center justify-between rounded-lg border p-3 text-sm"><span className="font-medium text-ink">{territory.town}, {territory.country}</span><span className="text-muted">{territory.active ? "Active" : "Inactive"}</span></div>)}{!territories.length && <p className="text-sm text-muted">No territories selected yet.</p>}</div></div>;
}
