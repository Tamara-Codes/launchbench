"use server";
import { desc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { mkdirSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { db, sqlite } from "@/db";
import {
  agents,
  agentPromptVersions,
  appSettings,
  auditLogs,
  emailDrafts,
  emailTemplates,
  followUpRules,
  gmailConnection,
  leadStatusHistory,
  leads,
  mediaAssets,
  products,
  productSocialStrategies,
  scheduledFollowUps,
  socialContentItems,
  territories,
  type EmailType,
  type LeadStatus,
  type SocialContentStatus,
} from "@/db/schema";
import { z } from "zod";
import { createRun, executeRun, requestCancel, resumeRun } from "./run-engine";
import { generateDraft } from "./email-service";
import {
  checkReplies,
  createGmailDraft,
  prepareDueFollowUps,
  sendDraft,
} from "./gmail-service";
import { composioGmail } from "@/providers/composio";
import { getEnv } from "@/env";
import { safeErrorMessage } from "@/lib/redact";
import { hasUnresolvedVariables, renderTemplate } from "@/lib/templates";
import { normalizeBusinessName } from "@/lib/normalize/name";
import { normalizeDomain, domainFromEmail } from "@/lib/normalize/domain";
import { normalizeEmail, isValidEmail } from "@/lib/normalize/email";
import { normalizePhone } from "@/lib/normalize/phone";
import { newId } from "@/lib/ids";
import { saveUploadedProductMedia, storageAbsolutePath } from "@/lib/media-storage";
import {
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_TARGET_CATEGORIES,
  DEFAULT_TASK_TEMPLATE,
} from "@/agents/lead-finder/prompts";
import { DEFAULT_SOCIAL_SYSTEM_PROMPT, DEFAULT_SOCIAL_TASK_TEMPLATE } from "@/agents/social-content/prompts";
import { generateSocialContent } from "./social-content-service";
import { buildContentPlan } from "@/lib/content-plan";
import { SELECTED_PRODUCT_COOKIE } from "./product-context";

export type ActionResult<T = unknown> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

function ok<T>(data?: T): ActionResult<T> {
  return { ok: true, data };
}
function fail(err: unknown): ActionResult<never> {
  return { ok: false, error: safeErrorMessage(err) };
}

/** Persist the product in focus without changing which products are active. */
export async function selectProduct(productId: string): Promise<ActionResult> {
  try {
    const [product] = await db.select({ id: products.id, active: products.active }).from(products).where(eq(products.id, productId));
    if (!product || !product.active) throw new Error("That product is no longer available.");
    (await cookies()).set(SELECTED_PRODUCT_COOKIE, product.id, { sameSite: "lax", path: "/" });
    revalidatePath("/", "layout");
    return ok();
  } catch (error) {
    return fail(error);
  }
}

const socialGenerationSchema = z.object({
  productId: z.string().min(1),
  contentType: z.string().min(1),
  format: z.enum(["single_image", "carousel", "story"]),
  language: z.string().min(2).max(12).default("hr"),
  extraInstruction: z.string().max(2000).default(""),
  referenceAssetIds: z.array(z.string()).max(8).default([]),
  mode: z.enum(["caption", "image", "full"]),
  variations: z.number().int().min(1).max(3).default(1),
});

/** Generate saved, product-aware content. The API key stays server-side. */
export async function createSocialContent(input: unknown): Promise<ActionResult<{ ids: string[] }>> {
  try {
    const values = socialGenerationSchema.parse(input);
    const items = await generateSocialContent(values);
    revalidatePath("/content-studio");
    revalidatePath("/content-history");
    revalidatePath("/content-calendar");
    revalidatePath("/");
    return ok({ ids: items.map((item) => item.id) });
  } catch (error) {
    return fail(error);
  }
}

const contentPlanSchema = z.object({
  productIds: z.array(z.string().min(1)).min(1).max(12),
  startDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  days: z.number().int().min(2).max(90).default(14),
  cadenceDays: z.number().int().min(1).max(14).default(2),
});

/** Saves a product-aware planning queue. It uses editable strategy priorities
 * and creates ideas only; no text or images are generated until requested. */
export async function createSocialContentPlan(input: unknown): Promise<ActionResult<{ ids: string[]; warnings: string[] }>> {
  try {
    const values = contentPlanSchema.parse(input);
    const selected = await db.select().from(products).where(inArray(products.id, values.productIds));
    const strategies = await db.select().from(productSocialStrategies).where(inArray(productSocialStrategies.productId, values.productIds));
    const planProducts = await Promise.all(selected.map(async (product) => {
      const strategy = strategies.find((item) => item.productId === product.id);
      const recent = await db.select({ hook: socialContentItems.hook }).from(socialContentItems).where(eq(socialContentItems.productId, product.id)).orderBy(desc(socialContentItems.createdAt)).limit(12);
      return { id: product.id, name: product.name, postingPriority: strategy?.postingPriority ?? product.postingPriority, directSalesFrequency: strategy?.directSalesFrequency ?? 1, pillars: strategy?.contentPillars ?? [], exampleIdeas: strategy?.exampleIdeas ?? [], recentHooks: recent.map((item) => item.hook) };
    }));
    const plan = buildContentPlan(planProducts, new Date(values.startDate), values.days, values.cadenceDays);
    if (!plan.length) throw new Error("Selected products need a social strategy with at least one content pillar.");
    const [socialAgent] = await db.select({ id: agents.id }).from(agents).where(eq(agents.slug, "social-content-agent"));
    const ids: string[] = [];
    for (const item of plan) {
      const [created] = await db.insert(socialContentItems).values({ productId: item.productId, sourceAgentId: socialAgent?.id ?? null, contentType: item.contentType, hook: item.hook, language: strategies.find((strategy) => strategy.productId === item.productId)?.preferredLanguage ?? "hr", status: "scheduled", scheduledFor: item.scheduledFor, notes: item.warnings.join("\n") }).returning();
      if (created) ids.push(created.id);
    }
    revalidatePath("/content-calendar");
    revalidatePath("/content-history");
    revalidatePath("/");
    return ok({ ids, warnings: plan.flatMap((item) => item.warnings) });
  } catch (error) {
    return fail(error);
  }
}

// ===========================================================================
// Media library
// ===========================================================================
const MAX_MEDIA_BYTES = 12 * 1024 * 1024;
const UPLOADABLE_MEDIA_TYPES = new Set([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function parseMediaTags(value: string) {
  return Array.from(
    new Set(value.split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean)),
  ).slice(0, 20);
}

export async function uploadProductMedia(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const productId = z.string().min(1).parse(formData.get("productId"));
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) throw new Error("Choose an image to upload.");
    if (!UPLOADABLE_MEDIA_TYPES.has(file.type)) {
      throw new Error("Upload an AVIF, GIF, JPEG, PNG, or WebP image.");
    }
    if (file.size > MAX_MEDIA_BYTES) throw new Error("Images must be 12 MB or smaller.");

    const [product] = await db.select({ id: products.id }).from(products).where(eq(products.id, productId)).limit(1);
    if (!product) throw new Error("Product not found.");

    const filePath = await saveUploadedProductMedia(productId, file.name, Buffer.from(await file.arrayBuffer()));
    try {
      const [asset] = await db
        .insert(mediaAssets)
        .values({
          productId,
          filePath,
          fileName: file.name.slice(0, 255) || "image",
          mimeType: file.type,
          tags: parseMediaTags(String(formData.get("tags") ?? "")),
          notes: String(formData.get("notes") ?? "").trim().slice(0, 1000),
        })
        .returning({ id: mediaAssets.id });
      revalidatePath("/media-library");
      return ok({ id: asset!.id });
    } catch (error) {
      await unlink(storageAbsolutePath(filePath)).catch(() => undefined);
      throw error;
    }
  } catch (e) {
    return fail(e);
  }
}

export async function setMediaAssetFlag(
  id: string,
  flag: "isPreferredReference" | "isApprovedBrandAsset",
  value: boolean,
): Promise<ActionResult> {
  try {
    const [asset] = await db.select({ id: mediaAssets.id }).from(mediaAssets).where(eq(mediaAssets.id, id)).limit(1);
    if (!asset) throw new Error("Media asset not found.");
    await db.update(mediaAssets).set({ [flag]: value }).where(eq(mediaAssets.id, id));
    revalidatePath("/media-library");
    return ok();
  } catch (e) {
    return fail(e);
  }
}

export async function deleteMediaAsset(id: string): Promise<ActionResult> {
  try {
    const [asset] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, id)).limit(1);
    if (!asset) throw new Error("Media asset not found.");
    await db.delete(mediaAssets).where(eq(mediaAssets.id, id));
    await unlink(storageAbsolutePath(asset.filePath)).catch(() => undefined);
    revalidatePath("/media-library");
    return ok();
  } catch (e) {
    return fail(e);
  }
}

function revalidateContentPages() {
  revalidatePath("/content-calendar");
  revalidatePath("/content-history");
}

// ==========================================================================
// Territories
// ==========================================================================
const territorySchema = z.object({
  town: z.string().min(1),
  country: z.string().min(1).default("Croatia"),
  includedSettlements: z.array(z.string()).default([]),
  excludedSettlements: z.array(z.string()).default([]),
  notes: z.string().default(""),
});

export async function createTerritory(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const data = territorySchema.parse(input);
    const [t] = await db.insert(territories).values(data).returning();
    revalidatePath("/find-leads");
    revalidatePath("/settings");
    return ok({ id: t!.id });
  } catch (e) {
    return fail(e);
  }
}

export async function updateTerritory(id: string, input: unknown): Promise<ActionResult> {
  try {
    const data = territorySchema.partial().parse(input);
    await db.update(territories).set(data).where(eq(territories.id, id));
    revalidatePath("/find-leads");
    return ok();
  } catch (e) {
    return fail(e);
  }
}

export async function activateTerritory(id: string): Promise<ActionResult> {
  try {
    await db.transaction((tx) => {
      tx.update(territories).set({ active: false }).run();
      tx.update(territories).set({ active: true }).where(eq(territories.id, id)).run();
      const existing = tx.select().from(appSettings).limit(1).all();
      if (existing.length) {
        tx.update(appSettings).set({ activeTerritoryId: id }).where(eq(appSettings.id, existing[0]!.id)).run();
      }
    });
    revalidatePath("/");
    revalidatePath("/find-leads");
    return ok();
  } catch (e) {
    return fail(e);
  }
}

export async function setTerritoryExhaustion(
  id: string,
  confirmed: boolean,
): Promise<ActionResult> {
  try {
    await db.update(territories).set({ confirmedExhausted: confirmed }).where(eq(territories.id, id));
    revalidatePath("/find-leads");
    return ok();
  } catch (e) {
    return fail(e);
  }
}

// ==========================================================================
// Agents & prompt versions
// ==========================================================================
const agentUpdateSchema = z.object({
  systemPrompt: z.string().min(1),
  taskPromptTemplate: z.string().min(1),
  model: z.string().min(1),
  temperature: z.number().min(0).max(2),
  enabled: z.boolean(),
  textProvider: z.literal("gemini"),
  imageProvider: z.literal("gemini").optional(),
  imageModel: z.string().max(160).optional().default(""),
  note: z.string().default(""),
});

async function saveAgentVersion(slug: string, values: z.infer<typeof agentUpdateSchema>) {
  const [agent] = await db.select().from(agents).where(eq(agents.slug, slug));
  if (!agent) throw new Error("Agent not found.");
  const [latest] = await db
    .select({ v: agentPromptVersions.version })
    .from(agentPromptVersions)
    .where(eq(agentPromptVersions.agentId, agent.id))
    .orderBy(desc(agentPromptVersions.version))
    .limit(1);
  const nextVersion = (latest?.v ?? 0) + 1;
  const configuration = {
    ...agent.configuration,
    textProvider: "gemini",
    ...(slug === "social-content-agent" ? { imageProvider: "gemini", imageModel: values.imageModel } : {}),
  };
  await db.transaction((tx) => {
    tx.update(agents)
      .set({
        systemPrompt: values.systemPrompt,
        taskPromptTemplate: values.taskPromptTemplate,
        model: values.model,
        temperature: values.temperature,
        maxOutputTokens: agent.maxOutputTokens,
        enabled: values.enabled,
        configuration,
      })
      .where(eq(agents.id, agent.id))
      .run();
    tx.insert(agentPromptVersions)
      .values({
        agentId: agent.id,
        version: nextVersion,
        systemPrompt: values.systemPrompt,
        taskPromptTemplate: values.taskPromptTemplate,
        model: values.model,
        temperature: values.temperature,
        maxOutputTokens: agent.maxOutputTokens,
        note: values.note || `Edited to v${nextVersion}`,
      })
      .run();
  });
  return nextVersion;
}

export async function updateAgentPrompt(slug: string, input: unknown): Promise<ActionResult<{ version: number }>> {
  try {
    const values = agentUpdateSchema.parse(input);
    const version = await saveAgentVersion(slug, values);
    revalidatePath(`/agents/${slug}`);
    revalidatePath("/agents");
    return ok({ version });
  } catch (e) {
    return fail(e);
  }
}

export async function restoreDefaultPrompt(slug: string): Promise<ActionResult> {
  try {
    const [agent] = await db.select().from(agents).where(eq(agents.slug, slug));
    if (!agent) throw new Error("Agent not found.");
    const defaults = slug === "social-content-agent"
      ? { systemPrompt: DEFAULT_SOCIAL_SYSTEM_PROMPT, taskPromptTemplate: DEFAULT_SOCIAL_TASK_TEMPLATE }
      : { systemPrompt: DEFAULT_SYSTEM_PROMPT, taskPromptTemplate: DEFAULT_TASK_TEMPLATE };
    await saveAgentVersion(slug, {
      ...defaults,
      model: agent.model,
      temperature: agent.temperature,
      enabled: agent.enabled,
      textProvider: "gemini",
      imageProvider: "gemini",
      imageModel: typeof agent.configuration.imageModel === "string" ? agent.configuration.imageModel : "",
      note: "Restored default prompt",
    });
    revalidatePath(`/agents/${slug}`);
    return ok();
  } catch (e) {
    return fail(e);
  }
}

export async function restoreAgentVersion(slug: string, versionId: string): Promise<ActionResult> {
  try {
    const [ver] = await db.select().from(agentPromptVersions).where(eq(agentPromptVersions.id, versionId));
    const [agent] = await db.select().from(agents).where(eq(agents.slug, slug));
    if (!ver || !agent) throw new Error("Version not found.");
    await saveAgentVersion(slug, {
      systemPrompt: ver.systemPrompt,
      taskPromptTemplate: ver.taskPromptTemplate,
      model: ver.model,
      temperature: ver.temperature,
      enabled: true,
      textProvider: "gemini",
      imageProvider: "gemini",
      imageModel: typeof agent.configuration.imageModel === "string" ? agent.configuration.imageModel : "",
      note: `Restored from v${ver.version}`,
    });
    revalidatePath(`/agents/${slug}`);
    return ok();
  } catch (e) {
    return fail(e);
  }
}

export async function toggleAgent(slug: string, enabled: boolean): Promise<ActionResult> {
  try {
    await db.update(agents).set({ enabled }).where(eq(agents.slug, slug));
    revalidatePath("/agents");
    return ok();
  } catch (e) {
    return fail(e);
  }
}

export async function previewPrompt(taskTemplate: string): Promise<ActionResult<{ rendered: string }>> {
  try {
    const sample = {
      target_count: "10",
      town: "Malinska",
      country: "Croatia",
      included_settlements: "Bogovići, Sveti Vid",
      excluded_settlements: "Krk, Punat",
      target_categories: DEFAULT_TARGET_CATEGORIES.join(", "),
      max_candidates: "60",
      max_queries: "15",
      max_pages_per_candidate: "3",
      product_name: "Digital Guest Welcome Book",
      product_context: "Digital guest guide accessed via QR code or link.",
    };
    const { text } = renderTemplate(taskTemplate, sample);
    return ok({ rendered: text });
  } catch (e) {
    return fail(e);
  }
}

// ==========================================================================
// Product / settings / templates / rules
// ==========================================================================
export async function updateProduct(id: string, input: unknown): Promise<ActionResult> {
  try {
    const schema = z.object({
      name: z.string().min(1),
      shortDescription: z.string(),
      fullDescription: z.string(),
      targetCustomer: z.string(),
      coreBenefit: z.string(),
      priceText: z.string(),
      demoUrl: z.string(),
      websiteUrl: z.string(),
      emailGenerationContext: z.string(),
      idealBusinessTypes: z.array(z.string().min(1)).max(30).default([]),
      fitSignals: z.array(z.string().min(1)).max(30).default([]),
      exclusions: z.array(z.string().min(1)).max(30).default([]),
      searchGuidance: z.string().max(4000).default(""),
    });
    const data = schema.parse(input);
    await db.update(products).set(data).where(eq(products.id, id));
    revalidatePath("/products");
    revalidatePath(`/products/${id}`);
    revalidatePath("/settings");
    return ok();
  } catch (e) {
    return fail(e);
  }
}

/** A product is a reusable source of truth for both agents. */
export async function createProduct(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const schema = z.object({
      name: z.string().min(1),
      shortDescription: z.string().default(""),
      fullDescription: z.string().default(""),
      targetCustomer: z.string().default(""),
      coreBenefit: z.string().default(""),
      priceText: z.string().default(""),
      demoUrl: z.string().default(""),
      websiteUrl: z.string().default(""),
      emailGenerationContext: z.string().default(""),
      idealBusinessTypes: z.array(z.string().min(1)).max(30).default([]),
      fitSignals: z.array(z.string().min(1)).max(30).default([]),
      exclusions: z.array(z.string().min(1)).max(30).default([]),
      searchGuidance: z.string().max(4000).default(""),
    });
    const values = schema.parse(input);
    const [product] = await db.insert(products).values({ ...values, active: true }).returning();
    if (!product) throw new Error("Product could not be created.");
    revalidatePath("/products");
    return ok({ id: product.id });
  } catch (error) {
    return fail(error);
  }
}

const socialStrategySchema = z.object({
  primaryPlatform: z.string().min(1).max(40),
  preferredLanguage: z.string().min(2).max(12),
  primaryAudience: z.string(),
  brandVoice: z.string(),
  coreMessages: z.array(z.string().min(1)).max(30),
  contentPillars: z.array(z.object({ name: z.string().min(1), purpose: z.string(), examples: z.array(z.string()) })).max(20),
  visualDirections: z.array(z.string().min(1)).max(30),
  prohibitedClaims: z.array(z.string().min(1)).max(30),
  bannedPhrases: z.array(z.string().min(1)).max(30),
  preferredCtas: z.array(z.string().min(1)).max(30),
  hashtagGuidance: z.string(),
  directSalesFrequency: z.number().int().min(0).max(10),
  postingPriority: z.number().int().min(0).max(100),
  exampleIdeas: z.array(z.string().min(1)).max(30),
  advancedContext: z.string().max(12000),
});

export async function updateProductSocialStrategy(productId: string, input: unknown): Promise<ActionResult> {
  try {
    const values = socialStrategySchema.parse(input);
    const [product] = await db.select({ id: products.id }).from(products).where(eq(products.id, productId));
    if (!product) throw new Error("Product not found.");
    const [existing] = await db.select({ id: productSocialStrategies.id }).from(productSocialStrategies).where(eq(productSocialStrategies.productId, productId));
    if (existing) await db.update(productSocialStrategies).set(values).where(eq(productSocialStrategies.id, existing.id));
    else await db.insert(productSocialStrategies).values({ productId, ...values });
    revalidatePath("/products");
    revalidatePath(`/products/${productId}`);
    revalidatePath("/settings");
    revalidatePath("/content-studio");
    return ok();
  } catch (error) {
    return fail(error);
  }
}

export async function updateSettings(input: unknown): Promise<ActionResult> {
  try {
    const schema = z.object({
      senderName: z.string(),
      senderCompany: z.string(),
      senderEmail: z.string(),
      senderSignature: z.string(),
      dailyLeadTarget: z.number().int().min(1).max(100),
    });
    const data = schema.parse(input);
    const [s] = await db.select().from(appSettings).limit(1);
    if (!s) throw new Error("Settings row missing; run db:seed.");
    await db.update(appSettings).set(data).where(eq(appSettings.id, s.id));
    revalidatePath("/settings");
    return ok();
  } catch (e) {
    return fail(e);
  }
}

export async function updateFollowUpRules(input: unknown): Promise<ActionResult> {
  try {
    const schema = z.object({
      firstFollowUpDays: z.number().int().min(1).max(60),
      finalFollowUpDays: z.number().int().min(1).max(60),
      maxFollowUps: z.number().int().min(0).max(5),
      stopAfterReply: z.boolean(),
      stopAfterOptOut: z.boolean(),
      stopAfterInvalidAddress: z.boolean(),
      stopAfterNotInterested: z.boolean(),
    });
    const data = schema.parse(input);
    const [r] = await db.select().from(followUpRules).limit(1);
    if (!r) await db.insert(followUpRules).values(data);
    else await db.update(followUpRules).set(data).where(eq(followUpRules.id, r.id));
    revalidatePath("/settings");
    revalidatePath("/follow-ups");
    return ok();
  } catch (e) {
    return fail(e);
  }
}

export async function updateTemplate(id: string, input: unknown): Promise<ActionResult> {
  try {
    const schema = z.object({ subject: z.string().min(1), body: z.string().min(1), active: z.boolean() });
    const data = schema.parse(input);
    const [t] = await db.select().from(emailTemplates).where(eq(emailTemplates.id, id));
    if (!t) throw new Error("Template not found.");
    await db
      .update(emailTemplates)
      .set({ ...data, version: t.version + 1 })
      .where(eq(emailTemplates.id, id));
    revalidatePath("/settings");
    return ok();
  } catch (e) {
    return fail(e);
  }
}

// ==========================================================================
// Runs
// ==========================================================================
const runConfigSchema = z.object({
  territoryId: z.string().min(1),
  agentId: z.string().min(1),
  productId: z.string().min(1),
  targetLeads: z.number().int().min(1).max(50).default(10),
  maxQueries: z.number().int().min(1).max(50).default(15),
  maxCandidates: z.number().int().min(1).max(200).default(60),
  maxPagesPerCandidate: z.number().int().min(1).max(10).default(3),
  targetCategories: z.array(z.string()).default(DEFAULT_TARGET_CATEGORIES),
});

export async function startRun(input: unknown): Promise<ActionResult<{ runId: string }>> {
  try {
    const c = runConfigSchema.parse(input);
    const run = await createRun({
      territoryId: c.territoryId,
      agentId: c.agentId,
      productId: c.productId,
      config: {
        targetLeads: c.targetLeads,
        maxQueries: c.maxQueries,
        maxCandidates: c.maxCandidates,
        maxPagesPerCandidate: c.maxPagesPerCandidate,
        targetCategories: c.targetCategories.length ? c.targetCategories : DEFAULT_TARGET_CATEGORIES,
        agentId: c.agentId,
        productId: c.productId,
      },
    });
    // Fire-and-forget: the UI polls the run row for progress.
    void executeRun(run.id);
    revalidatePath("/find-leads");
    return ok({ runId: run.id });
  } catch (e) {
    return fail(e);
  }
}

export async function cancelRun(runId: string): Promise<ActionResult> {
  try {
    await requestCancel(runId);
    return ok();
  } catch (e) {
    return fail(e);
  }
}

export async function resumeRunAction(runId: string): Promise<ActionResult> {
  try {
    await resumeRun(runId);
    return ok();
  } catch (e) {
    return fail(e);
  }
}

// ==========================================================================
// Leads
// ==========================================================================
export async function setLeadStatus(id: string, status: LeadStatus, reason = ""): Promise<ActionResult> {
  try {
    const [lead] = await db.select().from(leads).where(eq(leads.id, id));
    if (!lead) throw new Error("Lead not found.");
    await db.transaction((tx) => {
      tx.update(leads).set({ status }).where(eq(leads.id, id)).run();
      tx.insert(leadStatusHistory).values({ leadId: id, fromStatus: lead.status, toStatus: status, reason }).run();
    });
    await db.insert(auditLogs).values({
      eventType: "lead_status_change",
      entityType: "lead",
      entityId: id,
      leadId: id,
      territoryId: lead.territoryId,
      message: `Status → ${status}${reason ? ` (${reason})` : ""}`,
    });
    revalidatePath(`/leads/${id}`);
    revalidatePath("/leads");
    return ok();
  } catch (e) {
    return fail(e);
  }
}

export async function updateLead(id: string, input: unknown): Promise<ActionResult> {
  try {
    const schema = z.object({
      businessName: z.string().min(1),
      email: z.string(),
      phone: z.string(),
      website: z.string(),
      town: z.string(),
      settlement: z.string(),
      estimatedUnits: z.number().int().nullable(),
      notes: z.string(),
      languagePreference: z.string(),
    });
    const d = schema.parse(input);
    if (d.email && !isValidEmail(d.email)) throw new Error("Invalid email address.");
    await db
      .update(leads)
      .set({
        businessName: d.businessName,
        normalizedName: normalizeBusinessName(d.businessName),
        email: d.email ? normalizeEmail(d.email) : "",
        normalizedEmail: d.email ? normalizeEmail(d.email) : "",
        phone: d.phone,
        normalizedPhone: normalizePhone(d.phone),
        website: d.website,
        domain: normalizeDomain(d.website),
        normalizedDomain: normalizeDomain(d.website) || domainFromEmail(d.email),
        town: d.town,
        settlement: d.settlement,
        estimatedUnits: d.estimatedUnits,
        notes: d.notes,
        languagePreference: d.languagePreference,
      })
      .where(eq(leads.id, id));
    revalidatePath(`/leads/${id}`);
    return ok();
  } catch (e) {
    return fail(e);
  }
}

export async function createLead(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const schema = z.object({
      territoryId: z.string().min(1),
      businessName: z.string().min(1),
      email: z.string(),
      phone: z.string().default(""),
      website: z.string().default(""),
      town: z.string().default(""),
      estimatedUnits: z.number().int().nullable().default(null),
    });
    const d = schema.parse(input);
    if (d.email && !isValidEmail(d.email)) throw new Error("Invalid email address.");
    const id = newId();
    const email = d.email ? normalizeEmail(d.email) : "";
    await db.transaction((tx) => {
      tx.insert(leads)
        .values({
          id,
          territoryId: d.territoryId,
          businessName: d.businessName,
          normalizedName: normalizeBusinessName(d.businessName),
          email,
          normalizedEmail: email,
          phone: d.phone,
          normalizedPhone: normalizePhone(d.phone),
          website: d.website,
          domain: normalizeDomain(d.website),
          normalizedDomain: normalizeDomain(d.website) || domainFromEmail(email),
          town: d.town,
          estimatedUnits: d.estimatedUnits,
          status: "awaitingReview",
          facts: {
            verifiedFacts: [],
            inferredFacts: [],
            unknownFields: [],
            qualificationReasons: ["Manually created"],
            rejectionReasons: [],
            languages: [],
          },
        })
        .run();
      tx.insert(leadStatusHistory).values({ leadId: id, fromStatus: "", toStatus: "awaitingReview", reason: "Manual creation" }).run();
    });
    revalidatePath("/leads");
    return ok({ id });
  } catch (e) {
    return fail(e);
  }
}

// ==========================================================================
// Email drafts / queue
// ==========================================================================
export async function generateEmail(
  leadId: string,
  emailType: EmailType,
  language?: string,
): Promise<ActionResult<{ draftId: string; warnings: string[] }>> {
  try {
    const res = await generateDraft(leadId, emailType, language);
    await db.insert(auditLogs).values({
      eventType: "email_draft_generated",
      entityType: "lead",
      entityId: leadId,
      leadId,
      message: `Generated ${emailType} draft.`,
    });
    revalidatePath("/email-queue");
    revalidatePath(`/leads/${leadId}`);
    return ok({ draftId: res.draftId, warnings: res.warnings });
  } catch (e) {
    return fail(e);
  }
}

export async function updateDraft(id: string, input: unknown): Promise<ActionResult> {
  try {
    const schema = z.object({ subject: z.string().min(1), body: z.string().min(1) });
    const d = schema.parse(input);
    const unresolved: string[] = [];
    for (const [k, v] of Object.entries({ subject: d.subject, body: d.body })) {
      if (hasUnresolvedVariables(v)) unresolved.push(k);
    }
    await db
      .update(emailDrafts)
      .set({ subject: d.subject, body: d.body, unresolvedVariables: unresolved, status: "draft" })
      .where(eq(emailDrafts.id, id));
    revalidatePath("/email-queue");
    return ok();
  } catch (e) {
    return fail(e);
  }
}

export async function approveDraft(id: string): Promise<ActionResult> {
  try {
    const [d] = await db.select().from(emailDrafts).where(eq(emailDrafts.id, id));
    if (!d) throw new Error("Draft not found.");
    if (hasUnresolvedVariables(d.subject) || hasUnresolvedVariables(d.body))
      throw new Error("Cannot approve: unresolved variables remain.");
    await db.update(emailDrafts).set({ status: "approved" }).where(eq(emailDrafts.id, id));
    revalidatePath("/email-queue");
    return ok();
  } catch (e) {
    return fail(e);
  }
}

export async function rejectDraft(id: string): Promise<ActionResult> {
  try {
    await db.update(emailDrafts).set({ status: "rejected" }).where(eq(emailDrafts.id, id));
    revalidatePath("/email-queue");
    return ok();
  } catch (e) {
    return fail(e);
  }
}

export async function regenerateDraft(id: string): Promise<ActionResult<{ draftId: string }>> {
  try {
    const [d] = await db.select().from(emailDrafts).where(eq(emailDrafts.id, id));
    if (!d) throw new Error("Draft not found.");
    await db.update(emailDrafts).set({ status: "rejected" }).where(eq(emailDrafts.id, id));
    const res = await generateDraft(d.leadId, d.emailType, d.language);
    revalidatePath("/email-queue");
    return ok({ draftId: res.draftId });
  } catch (e) {
    return fail(e);
  }
}

export async function createGmailDraftAction(id: string): Promise<ActionResult> {
  try {
    await createGmailDraft(id);
    revalidatePath("/email-queue");
    return ok();
  } catch (e) {
    return fail(e);
  }
}

export async function sendDraftAction(id: string): Promise<ActionResult<{ alreadySent: boolean }>> {
  try {
    const res = await sendDraft(id);
    revalidatePath("/email-queue");
    revalidatePath("/leads");
    return ok({ alreadySent: res.alreadySent });
  } catch (e) {
    return fail(e);
  }
}

export async function bulkApprove(ids: string[]): Promise<ActionResult<{ approved: number }>> {
  try {
    let approved = 0;
    for (const id of ids) {
      const r = await approveDraft(id);
      if (r.ok) approved++;
    }
    revalidatePath("/email-queue");
    return ok({ approved });
  } catch (e) {
    return fail(e);
  }
}

export async function bulkSend(ids: string[]): Promise<ActionResult<{ sent: number; failed: number }>> {
  try {
    let sent = 0;
    let failed = 0;
    for (const id of ids) {
      const r = await sendDraftAction(id);
      if (r.ok) sent++;
      else failed++;
    }
    revalidatePath("/email-queue");
    return ok({ sent, failed });
  } catch (e) {
    return fail(e);
  }
}

// ==========================================================================
// Follow-ups
// ==========================================================================
export async function prepareFollowUps(): Promise<ActionResult<{ due: number }>> {
  try {
    const r = await prepareDueFollowUps();
    revalidatePath("/follow-ups");
    return ok(r);
  } catch (e) {
    return fail(e);
  }
}

export async function generateFollowUp(followUpId: string): Promise<ActionResult<{ draftId: string }>> {
  try {
    const [f] = await db.select().from(scheduledFollowUps).where(eq(scheduledFollowUps.id, followUpId));
    if (!f) throw new Error("Follow-up not found.");
    const res = await generateDraft(f.leadId, f.emailType);
    await db.update(scheduledFollowUps).set({ status: "prepared", draftId: res.draftId }).where(eq(scheduledFollowUps.id, followUpId));
    revalidatePath("/follow-ups");
    revalidatePath("/email-queue");
    return ok({ draftId: res.draftId });
  } catch (e) {
    return fail(e);
  }
}

// ==========================================================================
// Social content calendar / history
// ==========================================================================
const socialContentStatusSchema = z.enum([
  "idea",
  "generated",
  "approved",
  "scheduled",
  "posted",
  "skipped",
  "archived",
]);

function scheduleDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Choose a valid publish date and time.");
  return date;
}

export async function scheduleSocialContent(id: string, scheduledFor: string): Promise<ActionResult> {
  try {
    const date = scheduleDate(z.string().min(1).parse(scheduledFor));
    await db
      .update(socialContentItems)
      .set({ status: "scheduled", scheduledFor: date })
      .where(eq(socialContentItems.id, id));
    revalidateContentPages();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

export async function duplicateSocialContent(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const [item] = await db.select().from(socialContentItems).where(eq(socialContentItems.id, id));
    if (!item) throw new Error("Content item not found.");
    const [copy] = await db
      .insert(socialContentItems)
      .values({
        productId: item.productId,
        sourceAgentId: item.sourceAgentId,
        platform: item.platform,
        format: item.format,
        contentType: item.contentType,
        hook: item.hook,
        caption: item.caption,
        cta: item.cta,
        hashtags: item.hashtags,
        imagePrompt: item.imagePrompt,
        onImageText: item.onImageText,
        visualDirection: item.visualDirection,
        carouselPlan: item.carouselPlan,
        language: item.language,
        status: "idea",
        notes: item.notes,
      })
      .returning({ id: socialContentItems.id });
    revalidateContentPages();
    return ok({ id: copy!.id });
  } catch (e) {
    return fail(e);
  }
}

export async function markSocialContentPosted(id: string): Promise<ActionResult> {
  try {
    await db
      .update(socialContentItems)
      .set({ status: "posted", postedAt: new Date() })
      .where(eq(socialContentItems.id, id));
    revalidateContentPages();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

export async function archiveSocialContent(id: string): Promise<ActionResult> {
  try {
    await db.update(socialContentItems).set({ status: "archived" }).where(eq(socialContentItems.id, id));
    revalidateContentPages();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

export async function deleteSocialContent(id: string): Promise<ActionResult> {
  try {
    await db.delete(socialContentItems).where(eq(socialContentItems.id, id));
    revalidateContentPages();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

export async function setSocialContentStatus(id: string, status: SocialContentStatus): Promise<ActionResult> {
  try {
    await db.update(socialContentItems).set({ status: socialContentStatusSchema.parse(status) }).where(eq(socialContentItems.id, id));
    revalidateContentPages();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

// ========================================================================== 
// Gmail
// ==========================================================================
export async function connectGmail(): Promise<ActionResult<{ redirectUrl: string }>> {
  try {
    if (!composioGmail.isConfigured())
      throw new Error("Set COMPOSIO_API_KEY and COMPOSIO_AUTH_CONFIG_ID in .env.local first.");
    const [conn] = await db.select().from(gmailConnection).limit(1);
    const userId = conn?.composioUserId || "local-user";
    const callbackUrl = `${getEnv().NEXT_PUBLIC_APP_URL}/settings?gmail=connected`;
    const res = await composioGmail.initiate(userId, callbackUrl);
    if (conn) {
      await db
        .update(gmailConnection)
        .set({
          connectionRequestId: res.connectionId,
          connectedAccountId: res.connectionId,
          status: "initiated",
          authConfigId: composioGmail.authConfigId(),
          composioUserId: userId,
        })
        .where(eq(gmailConnection.id, conn.id));
    }
    return ok({ redirectUrl: res.redirectUrl });
  } catch (e) {
    return fail(e);
  }
}

export async function refreshGmailStatus(): Promise<ActionResult<{ status: string }>> {
  try {
    const [conn] = await db.select().from(gmailConnection).limit(1);
    if (!conn || !conn.connectedAccountId) throw new Error("No pending Gmail connection.");
    const status = await composioGmail.getStatus(conn.connectedAccountId);
    await db
      .update(gmailConnection)
      .set({
        status: status.status,
        accountEmail: status.accountEmail || conn.accountEmail,
        lastCheckedAt: new Date(),
      })
      .where(eq(gmailConnection.id, conn.id));
    revalidatePath("/settings");
    return ok({ status: status.status });
  } catch (e) {
    return fail(e);
  }
}

export async function disconnectGmail(): Promise<ActionResult> {
  try {
    const [conn] = await db.select().from(gmailConnection).limit(1);
    if (conn?.connectedAccountId) {
      try {
        await composioGmail.disconnect(conn.connectedAccountId);
      } catch {
        /* best effort */
      }
    }
    if (conn) {
      await db
        .update(gmailConnection)
        .set({ status: "disconnected", connectedAccountId: "", connectionRequestId: "", accountEmail: "" })
        .where(eq(gmailConnection.id, conn.id));
    }
    revalidatePath("/settings");
    return ok();
  } catch (e) {
    return fail(e);
  }
}

export async function checkGmailReplies(): Promise<ActionResult<{ repliesFound: number; optOuts: number }>> {
  try {
    const r = await checkReplies();
    revalidatePath("/follow-ups");
    revalidatePath("/leads");
    revalidatePath("/");
    return ok(r);
  } catch (e) {
    return fail(e);
  }
}

// ==========================================================================
// Data / backup
// ==========================================================================
export async function createBackup(): Promise<ActionResult<{ path: string }>> {
  try {
    const backupsDir = resolve(process.cwd(), "backups");
    mkdirSync(backupsDir, { recursive: true });
    const now = new Date();
    const ymd = now.toISOString().slice(0, 10);
    const hms = now.toISOString().slice(11, 19).replace(/:/g, "");
    const fileName = `sales-agent-${ymd}-${hms}.db`;
    const dest = resolve(backupsDir, fileName);
    // Safe online backup (accounts for WAL); never overwrites prior backups.
    await (sqlite as any).backup(dest);
    const [s] = await db.select().from(appSettings).limit(1);
    if (s) await db.update(appSettings).set({ lastBackupAt: now, lastBackupPath: dest }).where(eq(appSettings.id, s.id));
    revalidatePath("/settings");
    return ok({ path: dest });
  } catch (e) {
    return fail(e);
  }
}
