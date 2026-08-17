import "server-only";
import { z } from "zod";
import { firecrawl } from "@/providers/firecrawl";
import { googlePlaces, type GooglePlace, type TerritorySearchArea } from "@/providers/google-places";
import { gemini } from "@/providers/gemini";
import { DEFAULT_SYSTEM_PROMPT, PREFILTER_SYSTEM_PROMPT } from "@/agents/lead-finder/prompts";
import { geminiResponseSchema, leadAnalysisSchema, prefilterSchema } from "@/agents/lead-finder/schema";
import { pickEnrichmentUrls, classifyPage } from "@/agents/lead-finder/enrich";
import { qualifyLead, deterministicExclusionMatch } from "@/lib/qualify";
import { extractEmails, normalizeEmail } from "@/lib/normalize/email";
import { extractPhones } from "@/lib/normalize/phone";
import { normalizeDomain } from "@/lib/normalize/domain";
import { normalizeBusinessName } from "@/lib/normalize/name";
import { normalizeQuery } from "@/lib/normalize/query";
import { buildGooglePlacesQuery } from "@/lib/lead-search-query";
import { generateSallySearchPlan, sallySearchPlanSchema } from "@/agents/lead-finder/search-plan";
import { normalizeUrl, urlHash } from "@/lib/normalize/url";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeErrorMessage } from "@/lib/redact";
import { flushLangfuseTraces } from "@/providers/langfuse";
import { propagateAttributes, startActiveObservation } from "@langfuse/tracing";
import { appendTenantJobEvent, completeTenantJob, isTenantJobCancellationRequested, type ClaimedTenantJob } from "./tenant-job-worker";
import { recordIntegrationEvent } from "./tenant-observability";

/** Truncates a value logged as job-event metadata so a single verbose Gemini
 * response or scraped page can't bloat `agent_job_events` rows. */
function preview(text: string, max = 1_500): string {
  return text.length > max ? text.slice(0, max) + "…" : text;
}

const SALLY_MODEL = "gemini-3.5-flash";

/** Strips image markdown and collapses blank runs before content is spent as
 * LLM evidence — logos/screenshots never carry qualification-relevant facts,
 * so cutting them shrinks prompt tokens with no information loss. */
function stripEvidenceNoise(markdown: string): string {
  return markdown.replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\n{3,}/g, "\n\n");
}
const inputSchema = z.object({ territoryId: z.string().uuid(), targetLeads: z.number().int().min(1).max(50).default(10), maxQueries: z.number().int().min(1).max(20).default(8), maxCandidates: z.number().int().min(1).max(100).default(40), maxPagesPerCandidate: z.number().int().min(1).max(5).default(3) });
type SalesStats = { queriesCompleted: number; candidatesDiscovered: number; candidatesScraped: number; duplicatesFound: number; qualifiedLeads: number; manualReviewCandidates: number; errors: number };
type Candidate = { id: string; url: string; domain: string; title: string; query: string; googlePlace: GooglePlace | null };
type InitialEmailTemplate = { subject: string; body: string; language: string } | null;
const MAX_PAGE_MARKDOWN_CHARS = 40_000;

export async function runTenantSalesJob(job: ClaimedTenantJob) {
  if (!job.project_id) throw new Error("Sales job is missing a project.");
  const input = inputSchema.parse(job.input); const db = createAdminClient();
  const [{ data: project }, { data: territory }] = await Promise.all([db.from("projects").select("*").eq("id", job.project_id).eq("workspace_id", job.workspace_id).maybeSingle(), db.from("territories").select("*").eq("id", input.territoryId).eq("workspace_id", job.workspace_id).eq("project_id", job.project_id).maybeSingle()]);
  if (!project || !territory) throw new Error("Project or territory does not belong to this workspace.");
  if (!googlePlaces.isConfigured() || !firecrawl.isConfigured() || !gemini.isConfigured()) throw new Error("GOOGLE_PLACES_API_KEY, FIRECRAWL_API_KEY and GEMINI_API_KEY must be configured on the server.");
  const { data: initialTemplates, error: templateError } = await db.from("email_templates").select("subject,body,language").eq("workspace_id", job.workspace_id).eq("project_id", job.project_id).eq("sequence_step", "initial").eq("active", true);
  if (templateError) throw new Error(templateError.message);
  const initialTemplate: InitialEmailTemplate = initialTemplates?.find((template) => template.language === project.preferred_language) ?? initialTemplates?.[0] ?? null;
  const { data: run, error: runError } = await db.from("sales_runs").insert({ workspace_id: job.workspace_id, project_id: job.project_id, territory_id: territory.id, job_id: job.id, status: "running", stage: "planning", config: input, started_at: new Date().toISOString() }).select("id").single();
  if (runError || !run) throw new Error(runError?.message ?? "Could not create sales run.");
  await appendTenantJobEvent(job, "progress", `Starting Sally run for "${project.name}" in ${territory.town}, ${territory.country}.`, { runId: run.id, targetLeads: input.targetLeads, maxQueries: input.maxQueries, maxCandidates: input.maxCandidates });
  const stats: SalesStats = { queriesCompleted: 0, candidatesDiscovered: 0, candidatesScraped: 0, duplicatesFound: 0, qualifiedLeads: 0, manualReviewCandidates: 0, errors: 0 };
  let cancelled = false;
  let candidates: Candidate[] = [];
  let plan: string[] = [];
  await startActiveObservation("sally.sales-run", async (runSpan) => {
    runSpan.update({ input: { project: project.name, territory: `${territory.town}, ${territory.country}`, targetLeads: input.targetLeads } });
    await propagateAttributes(
      { userId: job.workspace_id, sessionId: territory.id, tags: ["sales-agent"], metadata: { projectId: job.project_id ?? "", territoryId: territory.id, runId: run.id } },
      async () => {
      const { data: pendingRows } = await db.from("sales_candidates").select("id,url,domain,title,query,google_place").eq("workspace_id", job.workspace_id).eq("territory_id", territory.id).eq("outcome", "discovered").order("created_at").limit(input.maxCandidates);
      candidates = (pendingRows ?? []).map((row) => ({ id: row.id, url: row.url, domain: row.domain, title: row.title, query: row.query, googlePlace: row.google_place && typeof row.google_place === "object" ? row.google_place as GooglePlace : null }));
      const parsedSearchPlan = sallySearchPlanSchema.safeParse(project.lead_search_plan);
      const existingCountries = parsedSearchPlan.success ? parsedSearchPlan.data.countries : [];
      const coversCountry = existingCountries.some((country) => country.localeCompare(territory.country, undefined, { sensitivity: "base" }) === 0);
      let searchPlan = parsedSearchPlan.success ? parsedSearchPlan.data : null;
      if (!searchPlan || searchPlan.textQueries.length === 0 || !coversCountry) {
        await appendTenantJobEvent(job, "progress", `Sally is preparing Google Maps searches for ${territory.country}.`);
        const planStartedAt = Date.now();
        try {
          searchPlan = await generateSallySearchPlan({
            name: project.name,
            fullDescription: project.full_description ?? "",
            targetCustomer: project.target_customer ?? "",
            coreBenefit: project.core_benefit ?? "",
            exclusions: Array.isArray(project.exclusions) ? project.exclusions : [],
            countries: [...existingCountries, territory.country],
            observationMetadata: { workspaceId: job.workspace_id, projectId: project.id, territoryId: territory.id, runId: run.id, jobId: job.id, trigger: "new_territory_country" },
          });
        } catch (error) {
          await recordIntegrationEvent({ workspaceId: job.workspace_id, projectId: project.id, territoryId: territory.id, jobId: job.id, provider: "gemini", operation: "generate_sally_search_plan", status: "failure", durationMs: Date.now() - planStartedAt, message: safeErrorMessage(error), metadata: { trigger: "new_territory_country", country: territory.country } });
          throw error;
        }
        const { error: planError } = await db.from("projects").update({
          lead_search_terms: searchPlan.textQueries,
          lead_search_plan: searchPlan,
          lead_search_plan_generated_at: new Date().toISOString(),
        }).eq("id", project.id).eq("workspace_id", job.workspace_id);
        if (planError) throw new Error(planError.message);
        const planDurationMs = Date.now() - planStartedAt;
        await recordIntegrationEvent({ workspaceId: job.workspace_id, projectId: project.id, territoryId: territory.id, jobId: job.id, provider: "gemini", operation: "generate_sally_search_plan", status: "success", durationMs: planDurationMs, metadata: { trigger: "new_territory_country", countries: searchPlan.countries, textQueries: searchPlan.textQueries } });
        await appendTenantJobEvent(job, "progress", `Sally generated and saved ${searchPlan.textQueries.length} Google Places searches.`, { provider: "gemini", operation: "generate_sally_search_plan", durationMs: planDurationMs, countries: searchPlan.countries, textQueries: searchPlan.textQueries });
        project.lead_search_plan = searchPlan;
        project.lead_search_terms = searchPlan.textQueries;
      }
      const { data: queryRows } = await db.from("sales_search_queries").select("normalized_query,next_page_token,pages_fetched,exhausted,provider").eq("workspace_id", job.workspace_id).eq("territory_id", territory.id);
      const queryState = new Map((queryRows ?? []).map((row) => [row.normalized_query, row]));
      const savePlaces = async (places: GooglePlace[], query: string) => {
        let fresh = 0;
        for (const [index, place] of places.entries()) {
          if (candidates.length >= input.maxCandidates) break;
          const url = normalizeUrl(place.website || place.googleMapsUri || "https://www.google.com/maps/place/?q=place_id:" + encodeURIComponent(place.id));
          const { data: candidate, error } = await db.from("sales_candidates").insert({ workspace_id: job.workspace_id, territory_id: territory.id, run_id: run.id, url, url_hash: urlHash(url), domain: normalizeDomain(place.website), title: place.displayName, snippet: place.formattedAddress, query, rank: index + 1, google_place_id: place.id, google_place: place, outcome: place.website ? "discovered" : "rejected_pre_scrape", rejection_reason: place.website ? "" : "Google Places has no public website to verify a contact email." }).select("id").single();
          if (error || !candidate) { stats.duplicatesFound++; continue; }
          fresh++; stats.candidatesDiscovered++;
          if (place.website) candidates.push({ id: candidate.id, url, domain: normalizeDomain(place.website), title: place.displayName, query, googlePlace: place });
        }
        return fresh;
      };

      const nearbyQuery = `Nearby businesses in ${territory.town}, ${territory.country}`;
      const nearbyKey = normalizeQuery(`nearby:${territory.town},${territory.country}`);
      if (!queryState.get(nearbyKey)?.exhausted && candidates.length < input.maxCandidates) {
        const nearbyStartedAt = Date.now();
        let nearbyOperation = "nearby_search";
        try {
          let area: TerritorySearchArea | null = territory.latitude != null && territory.longitude != null
            ? { latitude: Number(territory.latitude), longitude: Number(territory.longitude), radiusM: Number(territory.search_radius_m ?? 15_000) }
            : null;
          if (!area) {
            nearbyOperation = "resolve_territory";
            await appendTenantJobEvent(job, "progress", `Locating ${territory.town}, ${territory.country} on Google Maps.`);
            area = await googlePlaces.resolveTerritory(territory.town, territory.country);
            await db.from("territories").update({ latitude: area.latitude, longitude: area.longitude, search_radius_m: area.radiusM }).eq("id", territory.id);
            await recordIntegrationEvent({ workspaceId: job.workspace_id, projectId: project.id, territoryId: territory.id, jobId: job.id, provider: "google_places", operation: "resolve_territory", status: "success", durationMs: area.requestMeta?.durationMs, requestId: area.requestMeta?.requestId, metadata: { httpStatus: area.requestMeta?.status, town: territory.town, country: territory.country, latitude: area.latitude, longitude: area.longitude, radiusM: area.radiusM } });
          }
          nearbyOperation = "nearby_search";
          await appendTenantJobEvent(job, "progress", `Scanning businesses across the map area around ${territory.town}.`);
          const nearby = await googlePlaces.searchNearby(area);
          const fresh = await savePlaces(nearby.places, nearbyQuery);
          await db.from("sales_search_queries").upsert({ workspace_id: job.workspace_id, territory_id: territory.id, run_id: run.id, raw_query: nearbyQuery, normalized_query: nearbyKey, provider: "google_places_nearby", result_count: nearby.places.length, new_result_count: fresh, next_page_token: null, pages_fetched: 1, exhausted: true }, { onConflict: "workspace_id,territory_id,normalized_query" });
          await recordIntegrationEvent({ workspaceId: job.workspace_id, projectId: project.id, territoryId: territory.id, jobId: job.id, provider: "google_places", operation: "nearby_search", status: "success", durationMs: nearby.meta.durationMs, requestId: nearby.meta.requestId, metadata: { httpStatus: nearby.meta.status, query: nearbyQuery, resultCount: nearby.places.length, newCandidateCount: fresh, radiusM: area.radiusM } });
          await appendTenantJobEvent(job, "progress", `Google Maps area scan returned ${nearby.places.length} places (${fresh} new).`, { provider: "google_places", operation: "nearby_search", httpStatus: nearby.meta.status, durationMs: nearby.meta.durationMs, requestId: nearby.meta.requestId, resultCount: nearby.places.length, newCandidateCount: fresh });
          stats.queriesCompleted++;
        } catch (error) {
          stats.errors++;
          await recordIntegrationEvent({ workspaceId: job.workspace_id, projectId: project.id, territoryId: territory.id, jobId: job.id, provider: "google_places", operation: nearbyOperation, status: "failure", durationMs: Date.now() - nearbyStartedAt, message: safeErrorMessage(error), metadata: { town: territory.town, country: territory.country } });
          await appendTenantJobEvent(job, "progress", `Google Maps area scan failed: ${safeErrorMessage(error)}`, { level: "error" });
        }
      }

      plan = searchPlan.textQueries.map((term) => buildGooglePlacesQuery(term, territory.town, territory.country)).filter((query) => !queryState.get(normalizeQuery(query))?.exhausted).slice(0, input.maxQueries);
      for (const query of plan) {
        if (candidates.length >= input.maxCandidates) break;
        const key = normalizeQuery(query); const state = queryState.get(key);
        let page: Awaited<ReturnType<typeof googlePlaces.searchText>>;
        const queryStartedAt = Date.now();
        try { page = await googlePlaces.searchText(query, state?.next_page_token ?? ""); } catch (error) {
          stats.errors++;
          await recordIntegrationEvent({ workspaceId: job.workspace_id, projectId: project.id, territoryId: territory.id, jobId: job.id, provider: "google_places", operation: "text_search", status: "failure", durationMs: Date.now() - queryStartedAt, message: safeErrorMessage(error), metadata: { query, hadPageToken: Boolean(state?.next_page_token) } });
          await appendTenantJobEvent(job, "progress", `Google Places search failed for "${query}": ${safeErrorMessage(error)}`, { level: "error", query });
          continue;
        }
        const fresh = await savePlaces(page.places, query);
        await db.from("sales_search_queries").upsert({ workspace_id: job.workspace_id, territory_id: territory.id, run_id: run.id, raw_query: query, normalized_query: key, provider: "google_places", result_count: page.places.length, new_result_count: fresh, next_page_token: page.nextPageToken, pages_fetched: (state?.pages_fetched ?? 0) + 1, exhausted: !page.nextPageToken }, { onConflict: "workspace_id,territory_id,normalized_query" });
        await recordIntegrationEvent({ workspaceId: job.workspace_id, projectId: project.id, territoryId: territory.id, jobId: job.id, provider: "google_places", operation: "text_search", status: "success", durationMs: page.meta.durationMs, requestId: page.meta.requestId, metadata: { httpStatus: page.meta.status, query, resultCount: page.places.length, newCandidateCount: fresh, hasNextPage: Boolean(page.nextPageToken), pageNumber: (state?.pages_fetched ?? 0) + 1 } });
        await appendTenantJobEvent(job, "progress", `Google Places search "${query}" returned ${page.places.length} places (${fresh} new).`, { provider: "google_places", operation: "text_search", httpStatus: page.meta.status, durationMs: page.meta.durationMs, requestId: page.meta.requestId, query, resultCount: page.places.length, newCandidateCount: fresh, hasNextPage: Boolean(page.nextPageToken) });
        stats.queriesCompleted++;
      }
      await appendTenantJobEvent(job, "progress", "Ready to qualify " + candidates.length + " saved candidates.");
      for (const candidate of candidates) {
        if (stats.qualifiedLeads >= input.targetLeads) break;
        if (await isTenantJobCancellationRequested(job)) { await db.from("sales_runs").update({ status: "cancelled", stage: "cancelled", stats, completed_at: new Date().toISOString() }).eq("id", run.id); cancelled = true; return; }
        try { await processCandidate(job, run.id, project, territory, candidate, input.maxPagesPerCandidate, stats, initialTemplate); } catch (error) {
          stats.errors++;
          const message = safeErrorMessage(error);
          await appendTenantJobEvent(job, "progress", `Failed to process candidate "${candidate.title}" (${candidate.url}): ${message}`, { level: "error", candidateId: candidate.id, candidateUrl: candidate.url });
          await db.from("sales_candidates").update({ outcome: "error", rejection_reason: message }).eq("id", candidate.id);
        }
      }
      },
    );
    runSpan.update({ output: { qualified: stats.qualifiedLeads, manualReview: stats.manualReviewCandidates, errors: stats.errors, cancelled } });
  });
  await flushLangfuseTraces();
  if (cancelled) return;
  const exhaustionSignal = candidates.length === 0 && plan.length === 0 ? "All configured Google Places result pages have been processed for this territory." : "";
  await db.from("sales_runs").update({ status: "completed", stage: "completed", stats, exhaustion_signal: exhaustionSignal, completed_at: new Date().toISOString() }).eq("id", run.id);
  await appendTenantJobEvent(job, "progress", `Sally run finished: ${stats.qualifiedLeads} qualified, ${stats.manualReviewCandidates} for manual review, ${stats.errors} errors.`, { runId: run.id, stats });
  await completeTenantJob(job, { salesRunId: run.id, stats });
}

/**
 * Cheap triage before any page is scraped or the full evidence call runs.
 * First tries a free, deterministic exclusion match against the candidate's
 * name and Google Places category tags (the same logic `qualifyLead` applies
 * post-hoc, just run earlier so an obvious reject never reaches Firecrawl or
 * Gemini). Only when that doesn't decide it does a tiny, cheap Gemini call
 * with name/address/categories only — no scraped evidence — to catch
 * candidates that are obviously irrelevant to the ideal customer even though
 * they don't match a named exclusion. Fails open: a prefilter error never
 * blocks a candidate from full review, it just skips the savings.
 */
async function prefilterCandidate(job: ClaimedTenantJob, project: any, territory: any, candidate: Candidate, excludedBusinessTypes: string[]): Promise<{ pass: true } | { pass: false; reason: string }> {
  const placeTypes = candidate.googlePlace?.types ?? [];
  if (excludedBusinessTypes.length > 0) {
    const evidenceText = [candidate.title, ...placeTypes].join(" ");
    const matched = excludedBusinessTypes.find((exclusion) => deterministicExclusionMatch(exclusion, evidenceText));
    if (matched) return { pass: false, reason: `Matches project exclusion: "${matched}"` };
  }
  if (!project.target_customer && excludedBusinessTypes.length === 0) return { pass: true };

  const prompt = [
    "Territory: " + territory.town + " (" + territory.country + ")",
    "Candidate name: " + candidate.title,
    "Google Places categories: " + (placeTypes.join(", ") || "(unknown)"),
    "Google Places address: " + (candidate.googlePlace?.formattedAddress || "(unknown)"),
    "Ideal customer: " + (project.target_customer || "(not specified)"),
    "Excluded business types (reject on sight): " + (excludedBusinessTypes.join(", ") || "(none)"),
  ].join("\n");
  const startedAt = Date.now();
  try {
    const result = await gemini.generateStructured({
      model: SALLY_MODEL,
      systemPrompt: PREFILTER_SYSTEM_PROMPT,
      prompt,
      schema: prefilterSchema,
      schemaName: "sally-prefilter",
      temperature: 0,
      maxOutputTokens: 200,
      observationName: "sally.prefilter-candidate",
      observationMetadata: { workspaceId: job.workspace_id, projectId: job.project_id, candidateId: candidate.id, candidateUrl: candidate.url },
    });
    await recordIntegrationEvent({ workspaceId: job.workspace_id, projectId: project.id, territoryId: territory.id, jobId: job.id, provider: "gemini", operation: "prefilter_candidate", status: "success", durationMs: Date.now() - startedAt, metadata: { candidateId: candidate.id, model: SALLY_MODEL, worthFullReview: result.worthFullReview } });
    if (!result.worthFullReview) return { pass: false, reason: result.reason || "Prefiltered: unlikely to match the ideal customer" };
    return { pass: true };
  } catch (error) {
    await recordIntegrationEvent({ workspaceId: job.workspace_id, projectId: project.id, territoryId: territory.id, jobId: job.id, provider: "gemini", operation: "prefilter_candidate", status: "failure", durationMs: Date.now() - startedAt, message: safeErrorMessage(error), metadata: { candidateId: candidate.id, model: SALLY_MODEL } });
    return { pass: true };
  }
}

async function processCandidate(job: ClaimedTenantJob, runId: string, project: any, territory: any, candidate: Candidate, maxPages: number, stats: SalesStats, initialTemplate: InitialEmailTemplate) {
  await startActiveObservation("sally.process-candidate", async (candidateSpan) => {
    candidateSpan.update({ input: { title: candidate.title, url: candidate.url }, metadata: { candidateId: candidate.id } });
    const db = createAdminClient();
    const excludedBusinessTypes: string[] = project.exclusions ?? [];
    const prefilter = await prefilterCandidate(job, project, territory, candidate, excludedBusinessTypes);
    if (!prefilter.pass) {
      await db.from("sales_candidates").update({ outcome: "rejected", rejection_reason: prefilter.reason.slice(0, 400) }).eq("id", candidate.id);
      await appendTenantJobEvent(job, "progress", `Prefiltered "${candidate.title}": ${prefilter.reason}`, { candidateId: candidate.id, stage: "prefilter" });
      candidateSpan.update({ output: { outcome: "rejected", reasons: [prefilter.reason], stage: "prefilter" } });
      return;
    }
    const scrapeWithLogging = async (url: string, pageType: string) => {
      const startedAt = Date.now();
      try {
        const doc = await firecrawl.scrape(url);
        const durationMs = Date.now() - startedAt;
        await recordIntegrationEvent({ workspaceId: job.workspace_id, projectId: project.id, territoryId: territory.id, jobId: job.id, provider: "firecrawl", operation: "scrape", status: "success", durationMs, metadata: { candidateId: candidate.id, url, pageType, httpStatus: doc.httpStatus ?? null, markdownChars: doc.markdown.length } });
        await appendTenantJobEvent(job, "progress", `Firecrawl saved ${pageType} content for "${candidate.title}".`, { provider: "firecrawl", operation: "scrape", candidateId: candidate.id, url, pageType, httpStatus: doc.httpStatus ?? null, durationMs, markdownChars: doc.markdown.length });
        return doc;
      } catch (error) {
        await recordIntegrationEvent({ workspaceId: job.workspace_id, projectId: project.id, territoryId: territory.id, jobId: job.id, provider: "firecrawl", operation: "scrape", status: "failure", durationMs: Date.now() - startedAt, message: safeErrorMessage(error), metadata: { candidateId: candidate.id, url, pageType } });
        throw error;
      }
    };
    await appendTenantJobEvent(job, "progress", `Scraping "${candidate.title}" (${candidate.url}).`, { candidateId: candidate.id, candidateUrl: candidate.url });
    const landing = await scrapeWithLogging(candidate.url, "landing"); stats.candidatesScraped++;
    const landingMarkdown = landing.markdown.slice(0, MAX_PAGE_MARKDOWN_CHARS); const pages = [{ url: landing.url, markdown: landingMarkdown, pageType: "landing" }];
    for (const url of pickEnrichmentUrls(candidate.url, landingMarkdown, maxPages)) {
      try { const pageType = classifyPage(url); const doc = await scrapeWithLogging(url, pageType); pages.push({ url: doc.url, markdown: doc.markdown.slice(0, MAX_PAGE_MARKDOWN_CHARS), pageType }); }
      catch (error) { await appendTenantJobEvent(job, "progress", `Enrichment scrape skipped for ${url}: ${safeErrorMessage(error)}`, { level: "error", candidateId: candidate.id }); }
    }
    await db.from("sales_scraped_pages").insert(pages.map((page) => ({ workspace_id: job.workspace_id, candidate_id: candidate.id, url: normalizeUrl(page.url), url_hash: urlHash(page.url), domain: normalizeDomain(page.url), page_type: page.pageType, markdown: page.markdown })));
    const combined = pages.map((page) => page.markdown).join("\n\n"); const emails = extractEmails(combined); const phones = extractPhones(combined);
    const emailTemplateContext = initialTemplate ? "Initial email template (" + initialTemplate.language + "):\nSubject: " + initialTemplate.subject + "\nBody:\n" + initialTemplate.body : "No initial email template is saved. Draft from the project sales guidance and supported candidate facts.";
    const context = ["Territory town: " + territory.town + " (" + territory.country + ")", "Project: " + project.name, "Ideal customer to look for: " + (project.target_customer || "(not specified)"), "Project context: " + [project.full_description, project.core_benefit, project.website_url && "Website: " + project.website_url, project.email_generation_context, project.preferred_cta && "Preferred call to action: " + project.preferred_cta].filter(Boolean).join("\n"), "The email is signed by a " + (project.sender_gender || "female") + " sender; write any first-person grammar (verb conjugation, self-reference) to match that gender.", project.sender_signature && "End the email with this signature, used verbatim: " + project.sender_signature, excludedBusinessTypes.length > 0 && "Do NOT qualify these business types, reject on sight: " + excludedBusinessTypes.join(", "), emailTemplateContext, candidate.googlePlace && "Google Places: " + candidate.googlePlace.displayName + "; " + candidate.googlePlace.formattedAddress + (candidate.googlePlace.types.length ? "; categories: " + candidate.googlePlace.types.join(", ") : "") + ((candidate.googlePlace.internationalPhoneNumber || candidate.googlePlace.nationalPhoneNumber) ? "; phone: " + (candidate.googlePlace.internationalPhoneNumber || candidate.googlePlace.nationalPhoneNumber) : ""), "Extracted emails: " + (emails.join(", ") || "(none)"), "Extracted phones: " + (phones.join(", ") || "(none)")].filter(Boolean).join("\n");
    const model = SALLY_MODEL;
    const evidenceBlock = pages.map((page) => "URL: " + page.url + "\n" + stripEvidenceNoise(page.markdown).slice(0, 3_000)).join("\n---\n").slice(0, 12_000);
    const startedAt = Date.now();
    let result: Awaited<ReturnType<typeof gemini.analyze>>;
    try {
      result = await gemini.analyze({ model, systemInstruction: DEFAULT_SYSTEM_PROMPT, contextBlock: context, evidenceBlock, responseSchema: geminiResponseSchema, temperature: 0, maxOutputTokens: 8192, observationName: "sally.qualify-candidate", observationMetadata: { workspaceId: job.workspace_id, projectId: job.project_id, runId, candidateId: candidate.id, candidateUrl: candidate.url } });
    } catch (error) {
      await recordIntegrationEvent({ workspaceId: job.workspace_id, projectId: project.id, territoryId: territory.id, jobId: job.id, provider: "gemini", operation: "qualify_candidate", status: "failure", durationMs: Date.now() - startedAt, message: safeErrorMessage(error), metadata: { candidateId: candidate.id, model } });
      await appendTenantJobEvent(job, "progress", `Gemini call failed for "${candidate.title}": ${safeErrorMessage(error)}`, { level: "error", candidateId: candidate.id, model, durationMs: Date.now() - startedAt, contextPreview: preview(context) });
      throw error;
    }
    await recordIntegrationEvent({ workspaceId: job.workspace_id, projectId: project.id, territoryId: territory.id, jobId: job.id, provider: "gemini", operation: "qualify_candidate", status: "success", durationMs: Date.now() - startedAt, metadata: { candidateId: candidate.id, model, usage: result.usage } });
    await appendTenantJobEvent(job, "progress", `Gemini analyzed "${candidate.title}".`, { candidateId: candidate.id, model, durationMs: Date.now() - startedAt, usage: result.usage, responsePreview: preview(result.text) });
    const analysis = leadAnalysisSchema.parse(JSON.parse(result.text)); const domain = normalizeDomain(analysis.website || candidate.url) || candidate.domain; const verifiedEmail = emails.includes(normalizeEmail(analysis.publicEmail)) ? normalizeEmail(analysis.publicEmail) : "";
    const { data: duplicate } = await db.from("sales_leads").select("id").eq("workspace_id", job.workspace_id).or("normalized_domain.eq." + domain + ",normalized_email.eq." + verifiedEmail).limit(1).maybeSingle();
    if (duplicate) { stats.duplicatesFound++; await db.from("sales_candidates").update({ outcome: "duplicate", rejection_reason: "Existing lead domain or email", lead_id: duplicate.id }).eq("id", candidate.id); candidateSpan.update({ output: { outcome: "duplicate" } }); return; }
    const qualification = qualifyLead({ analysis, sourceEmails: emails, bounds: { town: territory.town, includedSettlements: territory.included_settlements ?? [], excludedSettlements: territory.excluded_settlements ?? [] }, settings: territory.qualification_settings, locationText: analysis.location + " " + combined.slice(0, 500), excludedBusinessTypes, placeTypes: candidate.googlePlace?.types ?? [] });
    await appendTenantJobEvent(job, "progress", `Qualification for "${candidate.title}": ${qualification.outcome} (score ${qualification.score}).`, { candidateId: candidate.id, outcome: qualification.outcome, score: qualification.score, reasons: qualification.reasons, rejectionReasons: qualification.rejectionReasons });
    if (qualification.outcome === "rejected") { await db.from("sales_candidates").update({ outcome: "rejected", rejection_reason: qualification.rejectionReasons.join("; ").slice(0, 400) }).eq("id", candidate.id); candidateSpan.update({ output: { outcome: "rejected", reasons: qualification.rejectionReasons } }); return; }
    const { data: lead, error } = await db.from("sales_leads").insert({ workspace_id: job.workspace_id, project_id: job.project_id, territory_id: territory.id, run_id: runId, business_name: analysis.businessName, business_type: analysis.businessType, town: territory.town, settlement: analysis.location, website: analysis.website, normalized_domain: domain, email: qualification.verifiedEmail, normalized_email: qualification.verifiedEmail, phone: phones[0] ?? "", normalized_phone: phones[0] ?? "", normalized_name: normalizeBusinessName(analysis.businessName), status: "awaiting_review", lead_score: qualification.score, confidence: analysis.confidence, draft_subject: analysis.emailDraft.subject.trim(), draft_body: analysis.emailDraft.body.trim(), draft_generated_at: new Date().toISOString(), facts: { verifiedFacts: analysis.verifiedFacts, inferredFacts: analysis.inferredFacts, unknownFields: analysis.unknownFields, offerRelevance: analysis.offerRelevance, modelFitReasons: analysis.fitReasons, modelDisqualifyingReasons: analysis.disqualifyingReasons, qualificationReasons: qualification.reasons } }).select("id").single();
    if (error || !lead) throw new Error(error?.message ?? "Could not save lead.");
    const evidence = [...analysis.sourceEvidence.map((e) => ({ url: e.url || candidate.url, field: e.field, snippet: e.snippet })), ...(candidate.googlePlace ? [{ url: candidate.googlePlace.googleMapsUri || candidate.url, field: "google_places", snippet: candidate.googlePlace.displayName + " - " + candidate.googlePlace.formattedAddress }] : [])];
    await db.from("sales_lead_sources").insert(evidence.map((e) => ({ workspace_id: job.workspace_id, lead_id: lead.id, url: e.url, url_hash: urlHash(e.url), field: e.field, snippet: e.snippet.slice(0, 500) })));
    await db.from("sales_lead_status_history").insert({ workspace_id: job.workspace_id, lead_id: lead.id, to_status: "awaiting_review", reason: qualification.outcome === "qualified" ? "Qualified by Sales Agent" : "Manual review required" });
    await db.from("sales_candidates").update({ outcome: qualification.outcome === "qualified" ? "qualified" : "manual_review", lead_id: lead.id }).eq("id", candidate.id);
    if (qualification.outcome === "qualified") stats.qualifiedLeads++; else stats.manualReviewCandidates++;
    candidateSpan.update({ output: { outcome: qualification.outcome, leadId: lead.id, score: qualification.score } });
  });
}
