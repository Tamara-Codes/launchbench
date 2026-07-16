import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  discoveredCandidates,
  duplicateMatches,
  leadSources,
  leadStatusHistory,
  leads,
  processedUrls,
  scrapedPages,
  searchQueries,
  searchRuns,
  type QualificationSettings,
  type RunStats,
} from "@/db/schema";
import type {
  AgentDefinition,
  AgentRunContext,
  AgentRunResult,
} from "@/agents/types";
import { firecrawl } from "@/providers/firecrawl";
import { gemini } from "@/providers/gemini";
import { findDuplicate, type KnownRecord } from "@/lib/dedupe";
import { type TerritoryBounds } from "@/lib/geo";
import { qualifyLead } from "@/lib/qualify";
import { extractEmails } from "@/lib/normalize/email";
import { extractPhones } from "@/lib/normalize/phone";
import { normalizeBusinessName } from "@/lib/normalize/name";
import { normalizeDomain } from "@/lib/normalize/domain";
import { normalizeEmail } from "@/lib/normalize/email";
import { normalizePhone } from "@/lib/normalize/phone";
import { normalizeQuery } from "@/lib/normalize/query";
import { normalizeUrl, urlHash } from "@/lib/normalize/url";
import { newId } from "@/lib/ids";
import { QUERY_TEMPLATES } from "./prompts";
import {
  leadAnalysisSchema,
  geminiResponseSchema,
  type LeadAnalysis,
} from "./schema";
import { loadGlobalContactKeys, loadTerritoryMemory, looksIrrelevant } from "./memory";
import { classifyPage, pickEnrichmentUrls, type PageType } from "./enrich";

export interface LeadFinderInput {
  territoryId: string;
  bounds: TerritoryBounds;
  country: string;
  targetLeads: number;
  maxQueries: number;
  maxCandidates: number;
  maxPagesPerCandidate: number;
  targetCategories: string[];
  systemPrompt: string;
  model: string;
  textProvider: "gemini";
  temperature: number;
  maxOutputTokens: number;
  productName: string;
  productContext: string;
  languagePref: string;
  qualification: QualificationSettings;
}

const inputSchema = z.object({
  territoryId: z.string().min(1),
  bounds: z.object({
    town: z.string().min(1),
    includedSettlements: z.array(z.string()),
    excludedSettlements: z.array(z.string()),
  }),
  country: z.string(),
  targetLeads: z.number().int().positive().max(50),
  maxQueries: z.number().int().positive().max(50),
  maxCandidates: z.number().int().positive().max(200),
  maxPagesPerCandidate: z.number().int().positive().max(10),
  targetCategories: z.array(z.string()),
  systemPrompt: z.string().min(1),
  model: z.string().min(1),
  textProvider: z.literal("gemini"),
  temperature: z.number().min(0).max(2),
  maxOutputTokens: z.number().int().positive(),
  productName: z.string(),
  productContext: z.string(),
  languagePref: z.string(),
  qualification: z.object({
    requirePublicEmail: z.boolean(),
    requireWithinTerritory: z.boolean(),
    requireWebsite: z.boolean(),
    requireIndependent: z.boolean(),
    minConfidence: z.number(),
    rejectExistingDigitalGuide: z.boolean(),
  }),
});

function emptyStats(): RunStats {
  return {
    queriesCompleted: 0,
    candidatesDiscovered: 0,
    candidatesRejectedPreScrape: 0,
    candidatesScraped: 0,
    duplicatesFound: 0,
    qualifiedLeads: 0,
    manualReviewCandidates: 0,
    errors: 0,
    firecrawlSearchCalls: 0,
    firecrawlScrapeCalls: 0,
    geminiCalls: 0,
    geminiPromptTokens: 0,
    geminiOutputTokens: 0,
  };
}

/** Build deterministic query plan, skipping normalized queries already run
 * or marked exhausted. Stays inside the territory (town is always appended). */
function buildQueryPlan(
  input: LeadFinderInput,
  alreadyRun: Set<string>,
  exhausted: Set<string>,
): { raw: string; normalized: string }[] {
  const plan: { raw: string; normalized: string }[] = [];
  const seen = new Set<string>();
  for (const tpl of QUERY_TEMPLATES) {
    if (plan.length >= input.maxQueries) break;
    const raw = tpl.replace(/\{town\}/g, input.bounds.town);
    const normalized = normalizeQuery(raw);
    if (seen.has(normalized) || exhausted.has(normalized) || alreadyRun.has(normalized))
      continue;
    seen.add(normalized);
    plan.push({ raw, normalized });
  }
  return plan;
}

async function persistStats(runId: string, stats: RunStats, patch: Partial<{
  stage: string;
  currentCandidate: string;
}> = {}) {
  await db
    .update(searchRuns)
    .set({ stats, lastEventAt: new Date(), ...patch })
    .where(eq(searchRuns.id, runId));
}

class LeadFinderAgent
  implements AgentDefinition<LeadFinderInput, AgentRunResult>
{
  slug = "accommodation-lead-finder";
  agentType = "lead_finder";

  validateInput(input: unknown): LeadFinderInput {
    return inputSchema.parse(input) as LeadFinderInput;
  }

  async execute(
    ctx: AgentRunContext<LeadFinderInput>,
  ): Promise<AgentRunResult> {
    const input = ctx.input;
    const { runId } = ctx;
    const stats = emptyStats();

    // ---- Stage 1: memory ----------------------------------------------------
    await persistStats(runId, stats, { stage: "planning" });
    await ctx.emit({ stage: "planning", message: "Loading territory memory…" });
    const memory = await loadTerritoryMemory(input.territoryId);
    const globalKeys = await loadGlobalContactKeys();
    for (const e of globalKeys.emails) memory.knownEmails.add(e);
    for (const d of globalKeys.domains) memory.knownDomains.add(d);
    await ctx.emit({
      stage: "planning",
      message: `Known: ${memory.knownDomains.size} domains, ${memory.knownEmails.size} emails, ${memory.processedUrlHashes.size} processed URLs.`,
    });

    // ---- Stage 2: search plan ----------------------------------------------
    const plan = buildQueryPlan(input, memory.allQueries, memory.exhaustedQueries);
    await ctx.emit({
      stage: "planning",
      message: `Planned ${plan.length} new queries (skipped ${memory.allQueries.size} already run).`,
    });

    // ---- Stage 3: discovery -------------------------------------------------
    await persistStats(runId, stats, { stage: "searching" });
    const withinRunRecords: KnownRecord[] = [];
    const discoveredThisRun: {
      candidateId: string;
      url: string;
      domain: string;
      title: string;
      snippet: string;
      query: string;
      rank: number;
    }[] = [];
    const seenUrlHashes = new Set<string>(memory.processedUrlHashes);
    const seenDomains = new Set<string>(memory.knownDomains);

    for (const q of plan) {
      if (await ctx.isCancelled()) return this.finish(runId, stats, "cancelled by user");
      if (discoveredThisRun.length >= input.maxCandidates) break;

      let hits: Awaited<ReturnType<typeof firecrawl.search>> = [];
      try {
        await ctx.emit({ stage: "searching", message: `Searching: "${q.raw}"` });
        hits = await firecrawl.search(q.raw, 10);
        stats.firecrawlSearchCalls++;
      } catch {
        stats.errors++;
        await ctx.emit({
          stage: "searching",
          message: `Search failed for "${q.raw}" (continuing).`,
        });
      }

      let newForQuery = 0;
      for (const hit of hits) {
        const h = urlHash(hit.url);
        const dom = normalizeDomain(hit.url);
        if (seenUrlHashes.has(h)) continue;
        // Deterministic pre-scrape rejection.
        let rejection = "";
        if (looksIrrelevant(hit.url, hit.title)) rejection = "irrelevant";
        else if (seenDomains.has(dom)) rejection = "duplicate-domain";

        seenUrlHashes.add(h);
        const candidateId = newId();
        await db.insert(discoveredCandidates).values({
          id: candidateId,
          runId,
          territoryId: input.territoryId,
          url: normalizeUrl(hit.url),
          urlHash: h,
          domain: dom,
          title: hit.title,
          snippet: hit.description,
          query: q.raw,
          rank: hit.position,
          outcome: rejection ? "rejectedPreScrape" : "discovered",
          rejectionReason: rejection,
        });
        stats.candidatesDiscovered++;
        if (rejection) {
          stats.candidatesRejectedPreScrape++;
          if (rejection === "duplicate-domain") stats.duplicatesFound++;
        } else {
          newForQuery++;
          seenDomains.add(dom);
          discoveredThisRun.push({
            candidateId,
            url: normalizeUrl(hit.url),
            domain: dom,
            title: hit.title,
            snippet: hit.description,
            query: q.raw,
            rank: hit.position,
          });
        }
      }

      // Record the query + whether it appears exhausted (no new candidates).
      await db.insert(searchQueries).values({
        territoryId: input.territoryId,
        runId,
        rawQuery: q.raw,
        normalizedQuery: q.normalized,
        source: "template",
        resultCount: hits.length,
        newResultCount: newForQuery,
        exhausted: hits.length > 0 && newForQuery === 0,
      });
      stats.queriesCompleted++;
      await persistStats(runId, stats);
    }

    await ctx.emit({
      stage: "deduplicating",
      message: `Discovered ${discoveredThisRun.length} candidates to enrich (rejected ${stats.candidatesRejectedPreScrape} pre-scrape).`,
    });

    // ---- Stages 4–8: enrich, analyze, dedupe, qualify, save -----------------
    await persistStats(runId, stats, { stage: "enriching" });

    for (const cand of discoveredThisRun) {
      if (stats.qualifiedLeads >= input.targetLeads) break;
      if (await ctx.isCancelled()) return this.finish(runId, stats, "cancelled by user");

      await persistStats(runId, stats, {
        stage: "enriching",
        currentCandidate: cand.title || cand.domain,
      });

      try {
        await this.processCandidate(ctx, input, cand, stats, [
          ...memory.knownRecords,
          ...withinRunRecords,
        ], memory);
      } catch {
        stats.errors++;
        await db
          .update(discoveredCandidates)
          .set({ outcome: "error", rejectionReason: "processing-error" })
          .where(eq(discoveredCandidates.id, cand.candidateId));
        await ctx.emit({
          stage: "enriching",
          message: `Candidate ${cand.domain} failed (continuing).`,
        });
      }
      await persistStats(runId, stats);
    }

    const partial = stats.qualifiedLeads < input.targetLeads;
    const signal = this.exhaustionSignal(stats, discoveredThisRun.length);
    return this.finish(
      runId,
      stats,
      "",
      partial ? "completedPartial" : "completed",
      signal,
    );
  }

  /** Enrich + analyze + dedupe + qualify + save a single candidate. */
  private async processCandidate(
    ctx: AgentRunContext<LeadFinderInput>,
    input: LeadFinderInput,
    cand: { candidateId: string; url: string; domain: string; title: string; snippet: string; query: string },
    stats: RunStats,
    knownRecords: KnownRecord[],
    memory: Awaited<ReturnType<typeof loadTerritoryMemory>>,
  ): Promise<void> {
    const { runId } = ctx;
    // Stage 4: scrape landing + minimal extra pages.
    await ctx.emit({ stage: "enriching", message: `Scraping ${cand.domain}` });
    const landing = await firecrawl.scrape(cand.url);
    stats.firecrawlScrapeCalls++;
    stats.candidatesScraped++;
    await this.saveScrape(cand.candidateId, landing.url, landing.title, landing.markdown, landing.httpStatus, "landing");
    await this.markProcessed(input.territoryId, landing.url, "scraped");

    const extraUrls = pickEnrichmentUrls(cand.url, landing.markdown, input.maxPagesPerCandidate);
    const pages: { url: string; markdown: string; type: PageType }[] = [
      { url: landing.url, markdown: landing.markdown, type: "landing" },
    ];
    for (const u of extraUrls) {
      if (memory.processedUrlHashes.has(urlHash(u))) continue;
      try {
        const doc = await firecrawl.scrape(u);
        stats.firecrawlScrapeCalls++;
        const pt = classifyPage(u);
        await this.saveScrape(cand.candidateId, doc.url, doc.title, doc.markdown, doc.httpStatus, pt);
        await this.markProcessed(input.territoryId, u, "scraped");
        pages.push({ url: doc.url, markdown: doc.markdown, type: pt });
      } catch {
        /* individual page failure is non-fatal */
      }
    }

    // Stage 4 (cont): deterministic extraction from the ACTUAL page text.
    const combinedText = pages.map((p) => p.markdown).join("\n\n");
    const sourceEmails = extractEmails(combinedText);
    const sourcePhones = extractPhones(combinedText);

    // Stage 5: structured analysis (cleaned, bounded evidence).
    const evidenceBlock = pages
      .map((p) => `URL: ${p.url}\nTYPE: ${p.type}\n${p.markdown.slice(0, 6000)}`)
      .join("\n\n----\n\n")
      .slice(0, 24000);

    const contextBlock = [
      `Territory town: ${input.bounds.town} (${input.country})`,
      `Included settlements: ${input.bounds.includedSettlements.join(", ") || "(none)"}`,
      `Excluded settlements: ${input.bounds.excludedSettlements.join(", ") || "(none)"}`,
      `Target categories: ${input.targetCategories.join(", ")}`,
      `Product: ${input.productName}`,
      `Product context: ${input.productContext}`,
      `Deterministically extracted emails (only these may be used): ${sourceEmails.join(", ") || "(none)"}`,
      `Deterministically extracted phones: ${sourcePhones.join(", ") || "(none)"}`,
      `Candidate landing URL: ${cand.url}`,
    ].join("\n");

    await ctx.emit({ stage: "qualifying", message: `Analyzing ${cand.domain}` });
    let analysis: LeadAnalysis;
    try {
      const result = await gemini.analyze({
          model: input.model,
          systemInstruction: input.systemPrompt,
          contextBlock,
          evidenceBlock,
          responseSchema: geminiResponseSchema,
          temperature: input.temperature,
          maxOutputTokens: input.maxOutputTokens,
        });
        stats.geminiCalls++;
        stats.geminiPromptTokens += result.usage.promptTokens;
        stats.geminiOutputTokens += result.usage.outputTokens;
      analysis = leadAnalysisSchema.parse(JSON.parse(result.text));
    } catch {
      stats.errors++;
      await db
        .update(discoveredCandidates)
        .set({ outcome: "error", rejectionReason: "invalid-model-output" })
        .where(eq(discoveredCandidates.id, cand.candidateId));
      await ctx.emit({ stage: "qualifying", message: `Malformed analysis for ${cand.domain}; skipped.` });
      return;
    }

    // Stage 6: deduplication (canonical keys).
    const verifiedEmailForKeys = sourceEmails.includes(normalizeEmail(analysis.publicEmail))
      ? normalizeEmail(analysis.publicEmail)
      : "";
    const domain = normalizeDomain(analysis.website || cand.url) || cand.domain;
    const keys = {
      normalizedEmail: verifiedEmailForKeys,
      normalizedDomain: domain,
      normalizedPhone: sourcePhones[0] ?? normalizePhone(analysis.publicPhone),
      normalizedName: normalizeBusinessName(analysis.businessName),
      locality: analysis.location || input.bounds.town,
    };
    const dup = findDuplicate(keys, knownRecords);
    if (dup && dup.resolution === "confirmed") {
      stats.duplicatesFound++;
      await db
        .update(discoveredCandidates)
        .set({ outcome: "duplicate", rejectionReason: dup.details, leadId: dup.matchedId })
        .where(eq(discoveredCandidates.id, cand.candidateId));
      // Preserve the new source URL/evidence against the existing lead.
      await db.insert(leadSources).values({
        leadId: dup.matchedId,
        url: cand.url,
        urlHash: urlHash(cand.url),
        field: "duplicate-source",
        snippet: `Re-discovered via "${cand.query}"`,
      });
      await ctx.emit({ stage: "deduplicating", message: `Duplicate of existing lead (${dup.matchType}).` });
      return;
    }

    // Stage 7: qualification (code decides).
    const locationText = `${analysis.location} ${combinedText.slice(0, 500)}`;
    const q = qualifyLead({
      analysis,
      sourceEmails,
      bounds: input.bounds,
      settings: input.qualification,
      locationText,
    });

    // Stage 8: save.
    if (q.outcome === "rejected") {
      await db
        .update(discoveredCandidates)
        .set({ outcome: "rejected", rejectionReason: q.rejectionReasons.join("; ").slice(0, 400) })
        .where(eq(discoveredCandidates.id, cand.candidateId));
      await this.markProcessed(input.territoryId, cand.url, "rejected");
      await ctx.emit({ stage: "qualifying", message: `Rejected ${cand.domain}: ${q.rejectionReasons[0] ?? "unqualified"}` });
      return;
    }

    const status = "awaitingReview" as const;
    const leadId = newId();
    const isQualified = q.outcome === "qualified";

    await db.transaction((tx) => {
      tx.insert(leads).values({
        id: leadId,
        territoryId: input.territoryId,
        runId,
        businessName: analysis.businessName,
        accommodationName: analysis.businessName,
        accommodationType: analysis.accommodationType,
        town: input.bounds.town,
        settlement: analysis.location,
        address: "",
        website: analysis.website,
        domain,
        normalizedDomain: domain,
        email: q.verifiedEmail,
        normalizedEmail: q.verifiedEmail,
        phone: keys.normalizedPhone,
        normalizedPhone: keys.normalizedPhone,
        contactPageUrl: pages.find((p) => p.type === "contact")?.url ?? "",
        normalizedName: keys.normalizedName,
        estimatedUnits: analysis.estimatedUnits ?? null,
        directBooking: analysis.directBooking,
        internationalGuestsLikely: analysis.internationalGuestsLikely,
        existingDigitalGuideDetected: analysis.existingDigitalGuideDetected,
        isInTargetLocation: q.geo === "inTerritory",
        languagePreference: analysis.languages.includes("en") && !analysis.languages.includes("hr") ? "en" : input.languagePref,
        status,
        leadScore: q.score,
        confidence: analysis.confidence,
        facts: {
          verifiedFacts: analysis.verifiedFacts,
          inferredFacts: analysis.inferredFacts,
          unknownFields: analysis.unknownFields,
          qualificationReasons: [...q.reasons, ...analysis.qualificationReasons],
          rejectionReasons: [...q.rejectionReasons, ...analysis.rejectionReasons],
          languages: analysis.languages,
        },
      });
      for (const ev of analysis.sourceEvidence) {
        tx.insert(leadSources).values({
          leadId,
          url: ev.url || cand.url,
          urlHash: urlHash(ev.url || cand.url),
          field: ev.field,
          snippet: ev.snippet.slice(0, 500),
        }).run();
      }
      tx.insert(leadStatusHistory).values({
        leadId,
        fromStatus: "",
        toStatus: status,
        reason: isQualified ? "Qualified by lead finder" : "Sent to manual review",
      }).run();
      tx.update(discoveredCandidates)
        .set({ outcome: isQualified ? "qualified" : "manualReview", leadId })
        .where(eq(discoveredCandidates.id, cand.candidateId))
        .run();
    });

    // Record uncertain duplicate for later manual review (never auto-merged).
    if (dup && dup.resolution === "uncertain") {
      await db.insert(duplicateMatches).values({
        leadId,
        candidateId: cand.candidateId,
        matchedLeadId: dup.matchedId,
        matchType: dup.matchType,
        score: dup.score,
        resolution: "uncertain",
        details: dup.details,
      });
    }

    knownRecords.push({ id: leadId, ...keys });
    await this.markProcessed(input.territoryId, cand.url, "scraped");

    if (isQualified) {
      stats.qualifiedLeads++;
      await ctx.emit({
        stage: "qualifying",
        message: `Candidate qualified: ${analysis.businessName} — ${stats.qualifiedLeads} of ${input.targetLeads} leads.`,
      });
    } else {
      stats.manualReviewCandidates++;
      await ctx.emit({
        stage: "qualifying",
        message: `Sent to manual review: ${analysis.businessName} (${q.geo}).`,
      });
    }
  }

  private async saveScrape(
    candidateId: string,
    url: string,
    title: string,
    markdown: string,
    httpStatus: number | undefined,
    pageType: string,
  ) {
    await db.insert(scrapedPages).values({
      candidateId,
      url: normalizeUrl(url),
      urlHash: urlHash(url),
      domain: normalizeDomain(url),
      pageType,
      title,
      markdown: markdown.slice(0, 40000),
      httpStatus: httpStatus ?? null,
    });
  }

  private async markProcessed(
    territoryId: string,
    url: string,
    action: string,
  ) {
    const h = urlHash(url);
    await db
      .insert(processedUrls)
      .values({
        territoryId,
        url: normalizeUrl(url),
        urlHash: h,
        domain: normalizeDomain(url),
        action,
        lastProcessedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: processedUrls.urlHash,
        set: { action, lastProcessedAt: new Date() },
      });
  }

  private exhaustionSignal(stats: RunStats, discovered: number): string {
    if (discovered === 0) return "No new candidates discovered — territory may be saturated.";
    const dupRate = stats.candidatesDiscovered
      ? stats.duplicatesFound / stats.candidatesDiscovered
      : 0;
    if (dupRate > 0.7 && stats.qualifiedLeads === 0)
      return "High duplicate rate and no new qualified leads.";
    return "";
  }

  private async finish(
    runId: string,
    stats: RunStats,
    cancelReason: string,
    status: "completed" | "completedPartial" | "cancelled" = "cancelled",
    signal = "",
  ): Promise<AgentRunResult> {
    const finalStatus = cancelReason ? "cancelled" : status;
    await db
      .update(searchRuns)
      .set({
        status: finalStatus,
        stage: finalStatus,
        stats,
        exhaustionSignal: signal,
        errorMessage: cancelReason,
        completedAt: new Date(),
        currentCandidate: "",
        lastEventAt: new Date(),
      })
      .where(eq(searchRuns.id, runId));
    return {
      qualified: stats.qualifiedLeads,
      manualReview: stats.manualReviewCandidates,
      rejected: stats.candidatesRejectedPreScrape,
      duplicates: stats.duplicatesFound,
      stats,
      exhaustionSignal: signal,
    };
  }
}

export const leadFinderAgent = new LeadFinderAgent();
