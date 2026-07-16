import "server-only";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  discoveredCandidates,
  leads,
  processedUrls,
  searchQueries,
} from "@/db/schema";
import type { KnownRecord } from "@/lib/dedupe";

export interface TerritoryMemory {
  exhaustedQueries: Set<string>; // normalized
  allQueries: Set<string>; // normalized
  processedUrlHashes: Set<string>;
  knownDomains: Set<string>;
  knownEmails: Set<string>;
  knownPhones: Set<string>;
  knownRecords: KnownRecord[]; // for dedupe
  contactedLeadIds: Set<string>;
  rejectedUrlHashes: Set<string>;
}

/**
 * Stage 1 — load everything the app already knows about this territory so we
 * never repeat searches or re-research the same businesses. No LLM involved.
 */
export async function loadTerritoryMemory(
  territoryId: string,
): Promise<TerritoryMemory> {
  const [queries, urls, leadRows, candRows] = await Promise.all([
    db.select().from(searchQueries).where(eq(searchQueries.territoryId, territoryId)),
    db.select().from(processedUrls).where(eq(processedUrls.territoryId, territoryId)),
    db.select().from(leads).where(eq(leads.territoryId, territoryId)),
    db
      .select()
      .from(discoveredCandidates)
      .where(eq(discoveredCandidates.territoryId, territoryId)),
  ]);

  const exhaustedQueries = new Set<string>();
  const allQueries = new Set<string>();
  for (const q of queries) {
    allQueries.add(q.normalizedQuery);
    if (q.exhausted) exhaustedQueries.add(q.normalizedQuery);
  }

  const processedUrlHashes = new Set<string>();
  const knownDomains = new Set<string>();
  const rejectedUrlHashes = new Set<string>();
  for (const u of urls) {
    processedUrlHashes.add(u.urlHash);
    if (u.domain) knownDomains.add(u.domain);
    if (u.action === "rejected") rejectedUrlHashes.add(u.urlHash);
  }
  for (const c of candRows) {
    processedUrlHashes.add(c.urlHash);
    if (c.domain) knownDomains.add(c.domain);
  }

  const knownEmails = new Set<string>();
  const knownPhones = new Set<string>();
  const knownRecords: KnownRecord[] = [];
  const contactedLeadIds = new Set<string>();
  for (const l of leadRows) {
    if (l.normalizedEmail) knownEmails.add(l.normalizedEmail);
    if (l.normalizedPhone) knownPhones.add(l.normalizedPhone);
    if (l.normalizedDomain) knownDomains.add(l.normalizedDomain);
    knownRecords.push({
      id: l.id,
      normalizedEmail: l.normalizedEmail,
      normalizedDomain: l.normalizedDomain,
      normalizedPhone: l.normalizedPhone,
      normalizedName: l.normalizedName,
      locality: l.settlement || l.town,
    });
    if (
      ["contacted", "followUpDue", "replied", "interested", "customer"].includes(
        l.status,
      )
    ) {
      contactedLeadIds.add(l.id);
    }
  }

  return {
    exhaustedQueries,
    allQueries,
    processedUrlHashes,
    knownDomains,
    knownEmails,
    knownPhones,
    knownRecords,
    contactedLeadIds,
    rejectedUrlHashes,
  };
}

/** Cross-territory known emails/domains (a business already contacted anywhere
 * should not be re-contacted). */
export async function loadGlobalContactKeys(): Promise<{
  emails: Set<string>;
  domains: Set<string>;
}> {
  const rows = await db
    .select({
      email: leads.normalizedEmail,
      domain: leads.normalizedDomain,
      status: leads.status,
    })
    .from(leads)
    .where(
      inArray(leads.status, [
        "contacted",
        "followUpDue",
        "replied",
        "interested",
        "customer",
        "optedOut",
      ]),
    );
  const emails = new Set<string>();
  const domains = new Set<string>();
  for (const r of rows) {
    if (r.email) emails.add(r.email);
    if (r.domain) domains.add(r.domain);
  }
  return { emails, domains };
}

/** Deterministic pre-scrape rejection of obviously irrelevant search hits. */
const IRRELEVANT_HINTS = [
  "wikipedia.org",
  "news",
  "vijesti",
  "blog",
  "tz-",
  "tourist-board",
  "turisticka-zajednica",
  "visit",
  "restaurant",
  "restoran",
  "konoba",
  "pizzeria",
];

export function looksIrrelevant(url: string, title: string): boolean {
  const hay = `${url} ${title}`.toLowerCase();
  return IRRELEVANT_HINTS.some((h) => hay.includes(h));
}
