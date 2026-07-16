import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  agents,
  appSettings,
  auditLogs,
  discoveredCandidates,
  leads,
  products,
  searchRuns,
  territories,
  type QualificationSettings,
  type RunConfig,
} from "@/db/schema";
import { getAgentImplementation } from "@/agents/registry";
import type { AgentRunContext, RunEvent } from "@/agents/types";
import type { LeadFinderInput } from "@/agents/lead-finder";
import { ACTIVE_STATUSES, isResumable } from "@/lib/run-state";
import { safeErrorMessage } from "@/lib/redact";
import { DEFAULT_TARGET_CATEGORIES } from "@/agents/lead-finder/prompts";
import { agentModelSettings } from "@/lib/agent-models";

// Runs currently executing IN THIS PROCESS (guards against double-start on
// rapid clicks / retries). Cross-process/restart guarding uses the DB status.
const running = new Set<string>();

export function isRunningInProcess(runId: string): boolean {
  return running.has(runId);
}

export async function getActiveRun(territoryId?: string) {
  const rows = await db
    .select()
    .from(searchRuns)
    .where(
      territoryId
        ? and(
            eq(searchRuns.territoryId, territoryId),
            inArray(searchRuns.status, ACTIVE_STATUSES),
          )
        : inArray(searchRuns.status, ACTIVE_STATUSES),
    )
    .orderBy(desc(searchRuns.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export interface CreateRunParams {
  territoryId: string;
  agentId: string;
  productId: string;
  config: RunConfig;
}

export async function createRun(params: CreateRunParams) {
  // Prevent multiple simultaneous active runs (spec §12).
  const active = await getActiveRun();
  if (active) {
    throw new Error(
      "A lead-search run is already active. Cancel or wait for it to finish.",
    );
  }
  const [run] = await db
    .insert(searchRuns)
    .values({
      territoryId: params.territoryId,
      agentId: params.agentId,
      productId: params.productId,
      status: "queued",
      stage: "queued",
      config: params.config,
      stats: {
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
      },
      startedAt: new Date(),
    })
    .returning();
  return run!;
}

async function emitEvent(
  runId: string,
  territoryId: string,
  event: RunEvent,
): Promise<void> {
  await db.insert(auditLogs).values({
    eventType: "run_event",
    entityType: "search_run",
    entityId: runId,
    territoryId,
    message: event.message,
    metadata: { stage: event.stage ?? "" },
  });
}

async function isCancelRequested(runId: string): Promise<boolean> {
  const [row] = await db
    .select({ c: searchRuns.cancelRequested })
    .from(searchRuns)
    .where(eq(searchRuns.id, runId))
    .limit(1);
  return Boolean(row?.c);
}

/** Build the agent input from the persisted run + related config rows. */
async function buildInput(runId: string): Promise<{
  input: LeadFinderInput;
  slug: string;
  territoryId: string;
}> {
  const [run] = await db.select().from(searchRuns).where(eq(searchRuns.id, runId));
  if (!run) throw new Error("Run not found.");
  const [territory] = await db
    .select()
    .from(territories)
    .where(eq(territories.id, run.territoryId));
  const [agent] = await db.select().from(agents).where(eq(agents.id, run.agentId));
  const [product] = await db.select().from(products).where(eq(products.id, run.productId));
  const [settings] = await db.select().from(appSettings).limit(1);
  if (!territory || !agent || !product) throw new Error("Run configuration incomplete.");

  const qualification: QualificationSettings =
    settings?.qualificationSettings ?? {
      requirePublicEmail: true,
      requireWithinTerritory: true,
      requireWebsite: true,
      requireIndependent: false,
      minConfidence: 0.5,
      rejectExistingDigitalGuide: false,
    };

  const productContext = [
    product.fullDescription,
    product.coreBenefit,
    product.targetCustomer,
    product.emailGenerationContext,
  ]
    .filter(Boolean)
    .join("\n");
  const modelSettings = agentModelSettings(agent.configuration, agent.model, "gemini");

  const input: LeadFinderInput = {
    territoryId: territory.id,
    bounds: {
      town: territory.town,
      includedSettlements: territory.includedSettlements,
      excludedSettlements: territory.excludedSettlements,
    },
    country: territory.country,
    targetLeads: run.config.targetLeads,
    maxQueries: run.config.maxQueries,
    maxCandidates: run.config.maxCandidates,
    maxPagesPerCandidate: run.config.maxPagesPerCandidate,
    targetCategories: run.config.targetCategories?.length
      ? run.config.targetCategories
      : DEFAULT_TARGET_CATEGORIES,
    systemPrompt: agent.systemPrompt,
    model: agent.model,
    textProvider: modelSettings.textProvider,
    temperature: agent.temperature,
    maxOutputTokens: agent.maxOutputTokens,
    productName: product.name,
    productContext,
    languagePref: "hr",
    qualification,
  };
  return { input, slug: agent.slug, territoryId: territory.id };
}

/**
 * Execute a run to completion in the current server process. Fire-and-forget:
 * callers should NOT await this — the UI polls the run row for progress.
 * Progress is persisted continuously so a page refresh (or restart) loses
 * nothing.
 */
export async function executeRun(runId: string): Promise<void> {
  if (running.has(runId)) return;
  running.add(runId);
  try {
    const { input, slug, territoryId } = await buildInput(runId);
    const impl = getAgentImplementation(slug);
    if (!impl) throw new Error(`No implementation registered for agent "${slug}".`);

    // Reset cancel flag on (re)start.
    await db.update(searchRuns).set({ cancelRequested: false }).where(eq(searchRuns.id, runId));
    await emitEvent(runId, territoryId, { stage: "queued", message: "Search run started." });

    const ctx: AgentRunContext<LeadFinderInput> = {
      runId,
      input: impl.validateInput(input),
      emit: (e) => emitEvent(runId, territoryId, e),
      isCancelled: () => isCancelRequested(runId),
    };

    const result = await impl.execute(ctx);

    // Update territory rollups after a successful run.
    await updateTerritoryRollup(territoryId);
    await emitEvent(runId, territoryId, {
      stage: "completed",
      message: `Run finished — ${result.qualified} qualified, ${result.manualReview} for review, ${result.duplicates} duplicates.`,
    });
  } catch (err) {
    const message = safeErrorMessage(err);
    await db
      .update(searchRuns)
      .set({ status: "failed", stage: "failed", errorMessage: message, completedAt: new Date() })
      .where(eq(searchRuns.id, runId));
    try {
      const [run] = await db.select().from(searchRuns).where(eq(searchRuns.id, runId));
      if (run) await emitEvent(runId, run.territoryId, { stage: "failed", message: `Run failed: ${message}` });
    } catch {
      /* ignore secondary logging failure */
    }
  } finally {
    running.delete(runId);
  }
}

export async function requestCancel(runId: string): Promise<void> {
  await db.update(searchRuns).set({ cancelRequested: true }).where(eq(searchRuns.id, runId));
}

/** Resume an interrupted run (e.g. after an app restart). */
export async function resumeRun(runId: string): Promise<void> {
  const [run] = await db.select().from(searchRuns).where(eq(searchRuns.id, runId));
  if (!run) throw new Error("Run not found.");
  if (!isResumable(run.status)) throw new Error(`Run is ${run.status} and cannot be resumed.`);
  if (running.has(runId)) return;
  void executeRun(runId);
}

/** Recompute territory statistics + exhaustion suggestion from stored data. */
export async function updateTerritoryRollup(territoryId: string): Promise<void> {
  const leadRows = await db
    .select({ status: leads.status })
    .from(leads)
    .where(eq(leads.territoryId, territoryId));
  const candRows = await db
    .select({ outcome: discoveredCandidates.outcome })
    .from(discoveredCandidates)
    .where(eq(discoveredCandidates.territoryId, territoryId));
  const runRows = await db
    .select({ id: searchRuns.id, exhaustionSignal: searchRuns.exhaustionSignal, status: searchRuns.status })
    .from(searchRuns)
    .where(eq(searchRuns.territoryId, territoryId));

  const qualified = leadRows.length;
  const contacted = leadRows.filter((l) =>
    ["contacted", "followUpDue", "replied", "interested", "customer"].includes(l.status),
  ).length;
  const [settings] = await db.select().from(appSettings).limit(1);
  const exSettings = settings?.exhaustionSettings ?? {
    minRunsBeforeExhaustion: 3,
    duplicateRateThreshold: 0.7,
    consecutiveEmptyRuns: 2,
  };
  const finishedRuns = runRows.filter((r) => ["completed", "completedPartial"].includes(r.status));
  const recentEmptySignals = finishedRuns.slice(-exSettings.consecutiveEmptyRuns).filter((r) => r.exhaustionSignal);
  const possiblyExhausted =
    finishedRuns.length >= exSettings.minRunsBeforeExhaustion &&
    recentEmptySignals.length >= exSettings.consecutiveEmptyRuns;

  await db
    .update(territories)
    .set({
      totalSearchRuns: finishedRuns.length,
      totalCandidatesFound: candRows.length,
      totalQualifiedLeads: qualified,
      totalContacted: contacted,
      lastSearchedAt: new Date(),
      possiblyExhausted,
    })
    .where(eq(territories.id, territoryId));
}
