import "server-only";
import { z } from "zod";
import { firecrawl } from "@/providers/firecrawl";
import { gemini } from "@/providers/gemini";
import { DEFAULT_SYSTEM_PROMPT, QUERY_TEMPLATES } from "@/agents/lead-finder/prompts";
import { geminiResponseSchema, leadAnalysisSchema } from "@/agents/lead-finder/schema";
import { pickEnrichmentUrls, classifyPage } from "@/agents/lead-finder/enrich";
import { qualifyLead } from "@/lib/qualify";
import { extractEmails, normalizeEmail } from "@/lib/normalize/email";
import { extractPhones, normalizePhone } from "@/lib/normalize/phone";
import { normalizeDomain } from "@/lib/normalize/domain";
import { normalizeBusinessName } from "@/lib/normalize/name";
import { normalizeQuery } from "@/lib/normalize/query";
import { normalizeUrl, urlHash } from "@/lib/normalize/url";
import { createAdminClient } from "@/lib/supabase/admin";
import { appendTenantJobEvent, completeTenantJob, isTenantJobCancellationRequested, type ClaimedTenantJob } from "./tenant-job-worker";

const inputSchema = z.object({ territoryId: z.string().uuid(), targetLeads: z.number().int().min(1).max(50).default(10), maxQueries: z.number().int().min(1).max(20).default(8), maxCandidates: z.number().int().min(1).max(100).default(40), maxPagesPerCandidate: z.number().int().min(1).max(5).default(3) });
type SalesStats = { queriesCompleted: number; candidatesDiscovered: number; candidatesScraped: number; duplicatesFound: number; qualifiedLeads: number; manualReviewCandidates: number; errors: number };
const MAX_PAGE_MARKDOWN_CHARS = 40_000;

export async function runTenantSalesJob(job: ClaimedTenantJob) {
  if (!job.product_id) throw new Error("Sales job is missing a product.");
  const input = inputSchema.parse(job.input); const db = createAdminClient();
  const [{ data: product }, { data: territory }] = await Promise.all([
    db.from("products").select("*").eq("id", job.product_id).eq("workspace_id", job.workspace_id).maybeSingle(),
    db.from("territories").select("*").eq("id", input.territoryId).eq("workspace_id", job.workspace_id).eq("product_id", job.product_id).maybeSingle(),
  ]);
  if (!product || !territory) throw new Error("Product or territory does not belong to this workspace.");
  if (!firecrawl.isConfigured() || !gemini.isConfigured()) throw new Error("FIRECRAWL_API_KEY and GEMINI_API_KEY must be configured on the server.");
  const { data: run, error: runError } = await db.from("sales_runs").insert({ workspace_id: job.workspace_id, product_id: job.product_id, territory_id: territory.id, job_id: job.id, status: "running", stage: "planning", config: input, started_at: new Date().toISOString() }).select("id").single();
  if (runError || !run) throw new Error(runError?.message ?? "Could not create sales run.");
  const stats: SalesStats = { queriesCompleted: 0, candidatesDiscovered: 0, candidatesScraped: 0, duplicatesFound: 0, qualifiedLeads: 0, manualReviewCandidates: 0, errors: 0 };
  const { data: previousQueries } = await db.from("sales_search_queries").select("normalized_query").eq("workspace_id", job.workspace_id).eq("territory_id", territory.id);
  const seenQueries = new Set((previousQueries ?? []).map((row) => row.normalized_query));
  const plan = QUERY_TEMPLATES.map((template) => template.replace(/\{town\}/g, territory.town)).filter((raw) => !seenQueries.has(normalizeQuery(raw))).slice(0, input.maxQueries);
  await appendTenantJobEvent(job, "progress", `Planned ${plan.length} new searches for ${territory.town}.`);
  const candidates: Array<{ id: string; url: string; domain: string; title: string; query: string }> = [];
  const seenDomains = new Set<string>();
  for (const query of plan) {
    let hits: Awaited<ReturnType<typeof firecrawl.search>> = [];
    try { hits = await firecrawl.search(query, 10); } catch { stats.errors++; }
    let fresh = 0;
    for (const hit of hits) {
      if (candidates.length >= input.maxCandidates) break;
      const url = normalizeUrl(hit.url); const domain = normalizeDomain(url); const h = urlHash(url);
      if (seenDomains.has(domain)) continue; seenDomains.add(domain);
      const { data: candidate, error } = await db.from("sales_candidates").insert({ workspace_id: job.workspace_id, territory_id: territory.id, run_id: run.id, url, url_hash: h, domain, title: hit.title, snippet: hit.description, query, rank: hit.position }).select("id").single();
      if (error || !candidate) { stats.duplicatesFound++; continue; }
      candidates.push({ id: candidate.id, url, domain, title: hit.title, query }); fresh++; stats.candidatesDiscovered++;
    }
    await db.from("sales_search_queries").upsert({ workspace_id: job.workspace_id, territory_id: territory.id, run_id: run.id, raw_query: query, normalized_query: normalizeQuery(query), result_count: hits.length, new_result_count: fresh, exhausted: hits.length > 0 && fresh === 0 }, { onConflict: "workspace_id,territory_id,normalized_query" });
    stats.queriesCompleted++;
  }
  await appendTenantJobEvent(job, "progress", `Discovered ${candidates.length} new candidates.`);
  for (const candidate of candidates) {
    if (stats.qualifiedLeads >= input.targetLeads) break;
    if (await isTenantJobCancellationRequested(job)) {
      await db.from("sales_runs").update({ status: "cancelled", stage: "cancelled", stats, completed_at: new Date().toISOString() }).eq("id", run.id);
      return;
    }
    try { await processCandidate(job, run.id, product, territory, candidate, input.maxPagesPerCandidate, stats); } catch { stats.errors++; await db.from("sales_candidates").update({ outcome: "error", rejection_reason: "processing-error" }).eq("id", candidate.id); }
  }
  const status = stats.qualifiedLeads < input.targetLeads ? "completed" : "completed";
  await db.from("sales_runs").update({ status, stage: "completed", stats, completed_at: new Date().toISOString() }).eq("id", run.id);
  await completeTenantJob(job, { salesRunId: run.id, stats });
}

async function processCandidate(job: ClaimedTenantJob, runId: string, product: any, territory: any, candidate: { id: string; url: string; domain: string; title: string; query: string }, maxPages: number, stats: SalesStats) {
  const db = createAdminClient(); const landing = await firecrawl.scrape(candidate.url); stats.candidatesScraped++;
  const landingMarkdown = landing.markdown.slice(0, MAX_PAGE_MARKDOWN_CHARS);
  const pages = [{ url: landing.url, markdown: landingMarkdown, pageType: "landing" }];
  for (const url of pickEnrichmentUrls(candidate.url, landingMarkdown, maxPages)) { try { const doc = await firecrawl.scrape(url); pages.push({ url: doc.url, markdown: doc.markdown.slice(0, MAX_PAGE_MARKDOWN_CHARS), pageType: classifyPage(url) }); } catch {} }
  await db.from("sales_scraped_pages").insert(pages.map((page) => ({ workspace_id: job.workspace_id, candidate_id: candidate.id, url: normalizeUrl(page.url), url_hash: urlHash(page.url), domain: normalizeDomain(page.url), page_type: page.pageType, markdown: page.markdown })));
  const combined = pages.map((page) => page.markdown).join("\n\n"); const emails = extractEmails(combined); const phones = extractPhones(combined);
  const context = [`Territory town: ${territory.town} (${territory.country})`, `Included settlements: ${(territory.included_settlements ?? []).join(", ") || "(none)"}`, `Excluded settlements: ${(territory.excluded_settlements ?? []).join(", ") || "(none)"}`, `Product: ${product.name}`, `Product context: ${[product.full_description, product.core_benefit, product.website_url && `Website: ${product.website_url}`, product.email_generation_context].filter(Boolean).join("\n")}`, `Extracted emails: ${emails.join(", ") || "(none)"}`, `Extracted phones: ${phones.join(", ") || "(none)"}`].join("\n");
  const result = await gemini.analyze({ model: "gemini-3.5-flash", systemInstruction: DEFAULT_SYSTEM_PROMPT, contextBlock: context, evidenceBlock: pages.map((page) => `URL: ${page.url}\n${page.markdown.slice(0, 6000)}`).join("\n---\n").slice(0, 24_000), responseSchema: geminiResponseSchema, temperature: 0, maxOutputTokens: 2048 });
  const analysis = leadAnalysisSchema.parse(JSON.parse(result.text)); const domain = normalizeDomain(analysis.website || candidate.url) || candidate.domain; const verifiedEmail = emails.includes(normalizeEmail(analysis.publicEmail)) ? normalizeEmail(analysis.publicEmail) : "";
  const { data: duplicate } = await db.from("sales_leads").select("id").eq("workspace_id", job.workspace_id).or(`normalized_domain.eq.${domain},normalized_email.eq.${verifiedEmail}`).limit(1).maybeSingle();
  if (duplicate) { stats.duplicatesFound++; await db.from("sales_candidates").update({ outcome: "duplicate", rejection_reason: "Existing lead domain or email", lead_id: duplicate.id }).eq("id", candidate.id); return; }
  const qualification = qualifyLead({ analysis, sourceEmails: emails, bounds: { town: territory.town, includedSettlements: territory.included_settlements ?? [], excludedSettlements: territory.excluded_settlements ?? [] }, settings: territory.qualification_settings, locationText: `${analysis.location} ${combined.slice(0, 500)}` });
  if (qualification.outcome === "rejected") { await db.from("sales_candidates").update({ outcome: "rejected", rejection_reason: qualification.rejectionReasons.join("; ").slice(0, 400) }).eq("id", candidate.id); return; }
  const { data: lead, error } = await db.from("sales_leads").insert({ workspace_id: job.workspace_id, product_id: job.product_id, territory_id: territory.id, run_id: runId, business_name: analysis.businessName, accommodation_type: analysis.accommodationType, town: territory.town, settlement: analysis.location, website: analysis.website, normalized_domain: domain, email: qualification.verifiedEmail, normalized_email: qualification.verifiedEmail, phone: phones[0] ?? normalizePhone(analysis.publicPhone), normalized_phone: phones[0] ?? normalizePhone(analysis.publicPhone), normalized_name: normalizeBusinessName(analysis.businessName), status: "awaiting_review", lead_score: qualification.score, confidence: analysis.confidence, facts: { verifiedFacts: analysis.verifiedFacts, inferredFacts: analysis.inferredFacts, unknownFields: analysis.unknownFields, languages: analysis.languages, qualificationReasons: qualification.reasons } }).select("id").single();
  if (error || !lead) throw new Error(error?.message ?? "Could not save lead.");
  await db.from("sales_lead_sources").insert(analysis.sourceEvidence.map((e) => ({ workspace_id: job.workspace_id, lead_id: lead.id, url: e.url || candidate.url, url_hash: urlHash(e.url || candidate.url), field: e.field, snippet: e.snippet.slice(0, 500) })));
  await db.from("sales_lead_status_history").insert({ workspace_id: job.workspace_id, lead_id: lead.id, to_status: "awaiting_review", reason: qualification.outcome === "qualified" ? "Qualified by Sales Agent" : "Manual review required" });
  await db.from("sales_candidates").update({ outcome: qualification.outcome === "qualified" ? "qualified" : "manual_review", lead_id: lead.id }).eq("id", candidate.id);
  if (qualification.outcome === "qualified") stats.qualifiedLeads++; else stats.manualReviewCandidates++;
}
