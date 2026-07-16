import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { newId } from "../lib/ids";

// ---------------------------------------------------------------------------
// Shared column helpers
// ---------------------------------------------------------------------------
const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => newId());

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date());

const updatedAt = () =>
  integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date());

// ---------------------------------------------------------------------------
// Types stored inside JSON columns
// ---------------------------------------------------------------------------
export type SourceEvidence = {
  url: string;
  field: string;
  snippet: string;
};

export type AgentConfiguration = Record<string, unknown>;

// ===========================================================================
// Agents & prompt versioning
// ===========================================================================
export const agents = sqliteTable(
  "agents",
  {
    id: id(),
    name: text().notNull(),
    slug: text().notNull(),
    description: text().notNull().default(""),
    agentType: text().notNull(), // e.g. "lead_finder"
    enabled: integer({ mode: "boolean" }).notNull().default(true),
    systemPrompt: text().notNull(),
    taskPromptTemplate: text().notNull(),
    model: text().notNull().default("gemini-2.5-flash"),
    temperature: real().notNull().default(0.2),
    maxOutputTokens: integer().notNull().default(2048),
    configuration: text({ mode: "json" })
      .$type<AgentConfiguration>()
      .notNull()
      .default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("agents_slug_uq").on(t.slug)],
);

export const agentPromptVersions = sqliteTable(
  "agent_prompt_versions",
  {
    id: id(),
    agentId: text()
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    version: integer().notNull(),
    systemPrompt: text().notNull(),
    taskPromptTemplate: text().notNull(),
    model: text().notNull(),
    temperature: real().notNull(),
    maxOutputTokens: integer().notNull(),
    note: text().notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [
    index("apv_agent_idx").on(t.agentId),
    uniqueIndex("apv_agent_version_uq").on(t.agentId, t.version),
  ],
);

// ===========================================================================
// Products
// ===========================================================================
export const products = sqliteTable("products", {
  id: id(),
  name: text().notNull(),
  shortDescription: text().notNull().default(""),
  fullDescription: text().notNull().default(""),
  targetCustomer: text().notNull().default(""),
  coreBenefit: text().notNull().default(""),
  priceText: text().notNull().default(""),
  demoUrl: text().notNull().default(""),
  websiteUrl: text().notNull().default(""),
  emailGenerationContext: text().notNull().default(""),
  brandVoice: text().notNull().default(""),
  visualStyle: text().notNull().default(""),
  colorNotes: text().notNull().default(""),
  socialMediaNotes: text().notNull().default(""),
  preferredCta: text().notNull().default(""),
  preferredLanguage: text().notNull().default("hr"),
  contentDos: text().notNull().default(""),
  contentDonts: text().notNull().default(""),
  idealBusinessTypes: text({ mode: "json" }).$type<string[]>().notNull().default([]),
  fitSignals: text({ mode: "json" }).$type<string[]>().notNull().default([]),
  exclusions: text({ mode: "json" }).$type<string[]>().notNull().default([]),
  searchGuidance: text().notNull().default(""),
  postingPriority: integer().notNull().default(0),
  active: integer({ mode: "boolean" }).notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export type ContentPillar = {
  name: string;
  purpose: string;
  examples: string[];
};

/** Editable defaults for a product's social-content work. Kept separate from
 * product facts so future products can receive a complete strategy with no code changes. */
export const productSocialStrategies = sqliteTable(
  "product_social_strategies",
  {
    id: id(),
    productId: text().notNull().references(() => products.id, { onDelete: "cascade" }),
    primaryPlatform: text().notNull().default("instagram"),
    preferredLanguage: text().notNull().default("hr"),
    primaryAudience: text().notNull().default(""),
    brandVoice: text().notNull().default(""),
    coreMessages: text({ mode: "json" }).$type<string[]>().notNull().default([]),
    contentPillars: text({ mode: "json" }).$type<ContentPillar[]>().notNull().default([]),
    visualDirections: text({ mode: "json" }).$type<string[]>().notNull().default([]),
    prohibitedClaims: text({ mode: "json" }).$type<string[]>().notNull().default([]),
    bannedPhrases: text({ mode: "json" }).$type<string[]>().notNull().default([]),
    preferredCtas: text({ mode: "json" }).$type<string[]>().notNull().default([]),
    hashtagGuidance: text().notNull().default(""),
    directSalesFrequency: integer().notNull().default(1),
    postingPriority: integer().notNull().default(50),
    exampleIdeas: text({ mode: "json" }).$type<string[]>().notNull().default([]),
    advancedContext: text().notNull().default(""),
    updatedAt: updatedAt(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("product_social_strategy_product_uq").on(t.productId)],
);

// ===========================================================================
// Product-aware social content
// ===========================================================================
export type SocialPlatform = "instagram";
export type SocialFormat = "single_image" | "carousel" | "story";
export type SocialContentStatus =
  | "idea"
  | "generated"
  | "approved"
  | "scheduled"
  | "posted"
  | "skipped"
  | "archived";

export const mediaAssets = sqliteTable(
  "media_assets",
  {
    id: id(),
    productId: text().notNull().references(() => products.id, { onDelete: "cascade" }),
    filePath: text().notNull(),
    fileName: text().notNull(),
    mimeType: text().notNull(),
    width: integer(),
    height: integer(),
    tags: text({ mode: "json" }).$type<string[]>().notNull().default([]),
    notes: text().notNull().default(""),
    isPreferredReference: integer({ mode: "boolean" }).notNull().default(false),
    isApprovedBrandAsset: integer({ mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("media_product_idx").on(t.productId), index("media_created_idx").on(t.createdAt)],
);

export const socialContentItems = sqliteTable(
  "social_content_items",
  {
    id: id(),
    productId: text().notNull().references(() => products.id, { onDelete: "cascade" }),
    sourceAgentId: text().references(() => agents.id),
    platform: text().$type<SocialPlatform>().notNull().default("instagram"),
    format: text().$type<SocialFormat>().notNull().default("single_image"),
    contentType: text().notNull(),
    hook: text().notNull().default(""),
    caption: text().notNull().default(""),
    cta: text().notNull().default(""),
    hashtags: text({ mode: "json" }).$type<string[]>().notNull().default([]),
    imagePrompt: text().notNull().default(""),
    onImageText: text().notNull().default(""),
    visualDirection: text().notNull().default(""),
    carouselPlan: text({ mode: "json" }).$type<string[]>().notNull().default([]),
    language: text().notNull().default("hr"),
    status: text().$type<SocialContentStatus>().notNull().default("idea"),
    scheduledFor: integer("scheduled_for", { mode: "timestamp_ms" }),
    postedAt: integer("posted_at", { mode: "timestamp_ms" }),
    postedUrl: text().notNull().default(""),
    notes: text().notNull().default(""),
    rating: integer(),
    performedWell: integer({ mode: "boolean" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("social_product_idx").on(t.productId),
    index("social_status_idx").on(t.status),
    index("social_scheduled_idx").on(t.scheduledFor),
    index("social_created_idx").on(t.createdAt),
  ],
);

export const generatedImageAssets = sqliteTable(
  "generated_image_assets",
  {
    id: id(),
    socialContentItemId: text().notNull().references(() => socialContentItems.id, { onDelete: "cascade" }),
    productId: text().notNull().references(() => products.id, { onDelete: "cascade" }),
    filePath: text().notNull(),
    prompt: text().notNull(),
    provider: text().notNull().default("openai"),
    model: text().notNull(),
    generationSettings: text({ mode: "json" }).$type<Record<string, unknown>>().notNull().default({}),
    responseMetadata: text({ mode: "json" }).$type<Record<string, unknown>>().notNull().default({}),
    referenceAssetIds: text({ mode: "json" }).$type<string[]>().notNull().default([]),
    createdAt: createdAt(),
  },
  (t) => [index("generated_image_item_idx").on(t.socialContentItemId), index("generated_image_product_idx").on(t.productId)],
);

export const contentAgentRuns = sqliteTable(
  "content_agent_runs",
  {
    id: id(),
    agentId: text().notNull().references(() => agents.id),
    productId: text().notNull().references(() => products.id),
    actionType: text().notNull(),
    inputSummary: text().notNull().default(""),
    outputSummary: text().notNull().default(""),
    status: text().notNull().default("running"),
    error: text().notNull().default(""),
    startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  },
  (t) => [index("content_agent_runs_agent_idx").on(t.agentId), index("content_agent_runs_product_idx").on(t.productId)],
);

// ===========================================================================
// Territories
// ===========================================================================
export const territories = sqliteTable(
  "territories",
  {
    id: id(),
    productId: text().references(() => products.id),
    town: text().notNull(),
    country: text().notNull().default("Croatia"),
    includedSettlements: text({ mode: "json" })
      .$type<string[]>()
      .notNull()
      .default([]),
    excludedSettlements: text({ mode: "json" })
      .$type<string[]>()
      .notNull()
      .default([]),
    active: integer({ mode: "boolean" }).notNull().default(false),
    possiblyExhausted: integer({ mode: "boolean" }).notNull().default(false),
    confirmedExhausted: integer({ mode: "boolean" }).notNull().default(false),
    totalSearchRuns: integer().notNull().default(0),
    totalCandidatesFound: integer().notNull().default(0),
    totalQualifiedLeads: integer().notNull().default(0),
    totalContacted: integer().notNull().default(0),
    lastSearchedAt: integer("last_searched_at", { mode: "timestamp_ms" }),
    notes: text().notNull().default(""),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("territories_town_idx").on(t.town),
    index("territories_active_idx").on(t.active),
    uniqueIndex("territories_town_country_uq").on(t.town, t.country),
  ],
);

// ===========================================================================
// Search runs & queries
// ===========================================================================
export type RunStatus =
  | "queued"
  | "planning"
  | "searching"
  | "deduplicating"
  | "enriching"
  | "qualifying"
  | "generatingDrafts"
  | "completed"
  | "completedPartial"
  | "failed"
  | "cancelled"
  | "paused";

export type RunConfig = {
  targetLeads: number;
  maxQueries: number;
  maxCandidates: number;
  maxPagesPerCandidate: number;
  targetCategories: string[];
  agentId: string;
  productId: string;
};

export type RunStats = {
  queriesCompleted: number;
  candidatesDiscovered: number;
  candidatesRejectedPreScrape: number;
  candidatesScraped: number;
  duplicatesFound: number;
  qualifiedLeads: number;
  manualReviewCandidates: number;
  errors: number;
  firecrawlSearchCalls: number;
  firecrawlScrapeCalls: number;
  geminiCalls: number;
  geminiPromptTokens: number;
  geminiOutputTokens: number;
};

export const searchRuns = sqliteTable(
  "search_runs",
  {
    id: id(),
    territoryId: text()
      .notNull()
      .references(() => territories.id),
    agentId: text()
      .notNull()
      .references(() => agents.id),
    productId: text()
      .notNull()
      .references(() => products.id),
    status: text().$type<RunStatus>().notNull().default("queued"),
    stage: text().notNull().default("queued"),
    config: text({ mode: "json" }).$type<RunConfig>().notNull(),
    stats: text({ mode: "json" }).$type<RunStats>().notNull(),
    currentCandidate: text().notNull().default(""),
    lastEventAt: integer("last_event_at", { mode: "timestamp_ms" }),
    cancelRequested: integer({ mode: "boolean" }).notNull().default(false),
    exhaustionSignal: text().notNull().default(""),
    errorMessage: text().notNull().default(""),
    startedAt: integer("started_at", { mode: "timestamp_ms" }),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("runs_territory_idx").on(t.territoryId),
    index("runs_status_idx").on(t.status),
    index("runs_created_idx").on(t.createdAt),
  ],
);

export const searchQueries = sqliteTable(
  "search_queries",
  {
    id: id(),
    territoryId: text()
      .notNull()
      .references(() => territories.id),
    runId: text().references(() => searchRuns.id),
    rawQuery: text().notNull(),
    normalizedQuery: text().notNull(),
    source: text().notNull().default("template"), // template | gemini
    resultCount: integer().notNull().default(0),
    newResultCount: integer().notNull().default(0),
    exhausted: integer({ mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    index("queries_territory_idx").on(t.territoryId),
    index("queries_norm_idx").on(t.normalizedQuery),
    index("queries_run_idx").on(t.runId),
  ],
);

// ===========================================================================
// Discovery, processed URLs, scraped pages
// ===========================================================================
export const discoveredCandidates = sqliteTable(
  "discovered_candidates",
  {
    id: id(),
    runId: text()
      .notNull()
      .references(() => searchRuns.id),
    territoryId: text()
      .notNull()
      .references(() => territories.id),
    url: text().notNull(),
    urlHash: text().notNull(),
    domain: text().notNull(),
    title: text().notNull().default(""),
    snippet: text().notNull().default(""),
    query: text().notNull().default(""),
    rank: integer().notNull().default(0),
    // discovered | rejectedPreScrape | duplicate | scraped | qualified | manualReview | rejected | error
    outcome: text().notNull().default("discovered"),
    rejectionReason: text().notNull().default(""),
    leadId: text().references(() => leads.id),
    createdAt: createdAt(),
  },
  (t) => [
    index("cand_run_idx").on(t.runId),
    index("cand_territory_idx").on(t.territoryId),
    index("cand_domain_idx").on(t.domain),
    index("cand_outcome_idx").on(t.outcome),
    index("cand_urlhash_idx").on(t.urlHash),
  ],
);

export const processedUrls = sqliteTable(
  "processed_urls",
  {
    id: id(),
    territoryId: text().references(() => territories.id),
    url: text().notNull(),
    urlHash: text().notNull(),
    domain: text().notNull(),
    // searched | scraped | rejected
    action: text().notNull().default("scraped"),
    lastProcessedAt: integer("last_processed_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("processed_urlhash_uq").on(t.urlHash),
    index("processed_domain_idx").on(t.domain),
    index("processed_territory_idx").on(t.territoryId),
  ],
);

export const scrapedPages = sqliteTable(
  "scraped_pages",
  {
    id: id(),
    candidateId: text().references(() => discoveredCandidates.id),
    url: text().notNull(),
    urlHash: text().notNull(),
    domain: text().notNull(),
    pageType: text().notNull().default("landing"), // landing | contact | about | accommodation | booking
    title: text().notNull().default(""),
    markdown: text().notNull().default(""),
    httpStatus: integer(),
    scrapedAt: integer("scraped_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    createdAt: createdAt(),
  },
  (t) => [
    index("scraped_candidate_idx").on(t.candidateId),
    index("scraped_urlhash_idx").on(t.urlHash),
  ],
);

// ===========================================================================
// Leads
// ===========================================================================
export type LeadStatus =
  | "new"
  | "awaitingReview"
  | "approved"
  | "rejected"
  | "emailDrafted"
  | "contacted"
  | "followUpDue"
  | "replied"
  | "interested"
  | "customer"
  | "notInterested"
  | "optedOut"
  | "invalidContact"
  | "duplicate";

export type LeadFacts = {
  verifiedFacts: string[];
  inferredFacts: string[];
  unknownFields: string[];
  qualificationReasons: string[];
  rejectionReasons: string[];
  languages: string[];
};

export const leads = sqliteTable(
  "leads",
  {
    id: id(),
    productId: text().references(() => products.id),
    territoryId: text()
      .notNull()
      .references(() => territories.id),
    runId: text().references(() => searchRuns.id),
    businessName: text().notNull(),
    accommodationName: text().notNull().default(""),
    accommodationType: text().notNull().default(""),
    town: text().notNull().default(""),
    settlement: text().notNull().default(""),
    address: text().notNull().default(""),
    website: text().notNull().default(""),
    domain: text().notNull().default(""),
    normalizedDomain: text().notNull().default(""),
    email: text().notNull().default(""),
    normalizedEmail: text().notNull().default(""),
    phone: text().notNull().default(""),
    normalizedPhone: text().notNull().default(""),
    contactPageUrl: text().notNull().default(""),
    normalizedName: text().notNull().default(""),
    estimatedUnits: integer(),
    directBooking: integer({ mode: "boolean" }).notNull().default(false),
    internationalGuestsLikely: integer({ mode: "boolean" })
      .notNull()
      .default(false),
    existingDigitalGuideDetected: integer({ mode: "boolean" })
      .notNull()
      .default(false),
    isInTargetLocation: integer({ mode: "boolean" }).notNull().default(false),
    languagePreference: text().notNull().default("hr"),
    status: text().$type<LeadStatus>().notNull().default("awaitingReview"),
    leadScore: integer().notNull().default(0),
    confidence: real().notNull().default(0),
    facts: text({ mode: "json" }).$type<LeadFacts>().notNull(),
    notes: text().notNull().default(""),
    lastContactedAt: integer("last_contacted_at", { mode: "timestamp_ms" }),
    nextFollowUpAt: integer("next_follow_up_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("leads_territory_idx").on(t.territoryId),
    index("leads_status_idx").on(t.status),
    index("leads_norm_email_idx").on(t.normalizedEmail),
    index("leads_norm_domain_idx").on(t.normalizedDomain),
    index("leads_norm_phone_idx").on(t.normalizedPhone),
    index("leads_norm_name_idx").on(t.normalizedName),
    index("leads_next_followup_idx").on(t.nextFollowUpAt),
  ],
);

export const leadSources = sqliteTable(
  "lead_sources",
  {
    id: id(),
    leadId: text()
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    url: text().notNull(),
    urlHash: text().notNull(),
    field: text().notNull().default(""),
    snippet: text().notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [index("lead_sources_lead_idx").on(t.leadId)],
);

export const leadStatusHistory = sqliteTable(
  "lead_status_history",
  {
    id: id(),
    leadId: text()
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    fromStatus: text().notNull().default(""),
    toStatus: text().notNull(),
    reason: text().notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [index("lead_history_lead_idx").on(t.leadId)],
);

export const duplicateMatches = sqliteTable(
  "duplicate_matches",
  {
    id: id(),
    leadId: text().references(() => leads.id, { onDelete: "cascade" }),
    candidateId: text().references(() => discoveredCandidates.id),
    matchedLeadId: text().references(() => leads.id),
    matchType: text().notNull(), // email | domain | phone | nameLocality | fuzzy
    score: real().notNull().default(1),
    // confirmed | uncertain | merged | dismissed
    resolution: text().notNull().default("uncertain"),
    details: text().notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [
    index("dup_lead_idx").on(t.leadId),
    index("dup_matched_idx").on(t.matchedLeadId),
    index("dup_resolution_idx").on(t.resolution),
  ],
);

// ===========================================================================
// Email templates, drafts, sent
// ===========================================================================
export type EmailType = "initial" | "follow_up_1" | "follow_up_final" | "reply";

export const emailTemplates = sqliteTable(
  "email_templates",
  {
    id: id(),
    name: text().notNull(),
    language: text().notNull().default("hr"), // hr | en
    emailType: text().$type<EmailType>().notNull(),
    subject: text().notNull(),
    body: text().notNull(),
    version: integer().notNull().default(1),
    active: integer({ mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("templates_type_lang_idx").on(t.emailType, t.language),
  ],
);

export type DraftStatus =
  | "draft"
  | "approved"
  | "rejected"
  | "gmailDraftCreated"
  | "sent";

export const emailDrafts = sqliteTable(
  "email_drafts",
  {
    id: id(),
    leadId: text()
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    emailType: text().$type<EmailType>().notNull(),
    language: text().notNull().default("hr"),
    recipientEmail: text().notNull(),
    subject: text().notNull(),
    body: text().notNull(),
    status: text().$type<DraftStatus>().notNull().default("draft"),
    unresolvedVariables: text({ mode: "json" })
      .$type<string[]>()
      .notNull()
      .default([]),
    sourceFactsUsed: text({ mode: "json" })
      .$type<string[]>()
      .notNull()
      .default([]),
    warnings: text({ mode: "json" }).$type<string[]>().notNull().default([]),
    // Idempotency key to prevent duplicate Gmail sends.
    sendKey: text().notNull(),
    inReplyToThreadId: text().notNull().default(""),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("drafts_lead_idx").on(t.leadId),
    index("drafts_status_idx").on(t.status),
    uniqueIndex("drafts_sendkey_uq").on(t.sendKey),
  ],
);

export const sentEmails = sqliteTable(
  "sent_emails",
  {
    id: id(),
    leadId: text()
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    draftId: text().references(() => emailDrafts.id),
    emailType: text().$type<EmailType>().notNull(),
    recipientEmail: text().notNull(),
    subject: text().notNull(),
    body: text().notNull(),
    gmailMessageId: text().notNull().default(""),
    gmailThreadId: text().notNull().default(""),
    provider: text().notNull().default("composio_gmail"),
    sendKey: text().notNull(),
    sentAt: integer("sent_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    createdAt: createdAt(),
  },
  (t) => [
    index("sent_lead_idx").on(t.leadId),
    index("sent_thread_idx").on(t.gmailThreadId),
    uniqueIndex("sent_sendkey_uq").on(t.sendKey),
  ],
);

// ===========================================================================
// Gmail connection (single row)
// ===========================================================================
export const gmailConnection = sqliteTable("gmail_connection", {
  id: id(),
  connectedAccountId: text().notNull().default(""),
  connectionRequestId: text().notNull().default(""),
  status: text().notNull().default("disconnected"), // disconnected | initiated | active | expired | failed
  accountEmail: text().notNull().default(""),
  composioUserId: text().notNull().default("local-user"),
  authConfigId: text().notNull().default(""),
  lastCheckedAt: integer("last_checked_at", { mode: "timestamp_ms" }),
  lastReplyCheckAt: integer("last_reply_check_at", { mode: "timestamp_ms" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ===========================================================================
// Follow-ups
// ===========================================================================
export const followUpRules = sqliteTable("follow_up_rules", {
  id: id(),
  firstFollowUpDays: integer().notNull().default(4),
  finalFollowUpDays: integer().notNull().default(7),
  maxFollowUps: integer().notNull().default(2),
  stopAfterReply: integer({ mode: "boolean" }).notNull().default(true),
  stopAfterOptOut: integer({ mode: "boolean" }).notNull().default(true),
  stopAfterInvalidAddress: integer({ mode: "boolean" }).notNull().default(true),
  stopAfterNotInterested: integer({ mode: "boolean" }).notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export type FollowUpStatus =
  | "scheduled"
  | "due"
  | "prepared"
  | "sent"
  | "cancelledReply"
  | "cancelledOptOut"
  | "cancelledManual"
  | "completed";

export const scheduledFollowUps = sqliteTable(
  "scheduled_follow_ups",
  {
    id: id(),
    leadId: text()
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    sequence: integer().notNull().default(1), // 1 = first, 2 = final
    emailType: text().$type<EmailType>().notNull(),
    dueAt: integer("due_at", { mode: "timestamp_ms" }).notNull(),
    status: text().$type<FollowUpStatus>().notNull().default("scheduled"),
    draftId: text().references(() => emailDrafts.id),
    cancelledReason: text().notNull().default(""),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("followups_lead_idx").on(t.leadId),
    index("followups_due_idx").on(t.dueAt),
    index("followups_status_idx").on(t.status),
  ],
);

// ===========================================================================
// App settings (single row) & audit log
// ===========================================================================
export type QualificationSettings = {
  requirePublicEmail: boolean;
  requireWithinTerritory: boolean;
  requireWebsite: boolean;
  requireIndependent: boolean;
  minConfidence: number;
  rejectExistingDigitalGuide: boolean;
};

export type ExhaustionSettings = {
  minRunsBeforeExhaustion: number;
  duplicateRateThreshold: number;
  consecutiveEmptyRuns: number;
};

export const appSettings = sqliteTable("app_settings", {
  id: id(),
  activeTerritoryId: text().references(() => territories.id),
  activeProductId: text().references(() => products.id),
  senderName: text().notNull().default(""),
  senderCompany: text().notNull().default(""),
  senderEmail: text().notNull().default(""),
  senderSignature: text().notNull().default(""),
  dailyLeadTarget: integer().notNull().default(10),
  qualificationSettings: text({ mode: "json" })
    .$type<QualificationSettings>()
    .notNull(),
  exhaustionSettings: text({ mode: "json" })
    .$type<ExhaustionSettings>()
    .notNull(),
  lastBackupAt: integer("last_backup_at", { mode: "timestamp_ms" }),
  lastBackupPath: text().notNull().default(""),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: id(),
    eventType: text().notNull(),
    entityType: text().notNull().default(""),
    entityId: text().notNull().default(""),
    territoryId: text().references(() => territories.id),
    leadId: text().references(() => leads.id),
    message: text().notNull().default(""),
    metadata: text({ mode: "json" }).$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [
    index("audit_created_idx").on(t.createdAt),
    index("audit_event_idx").on(t.eventType),
    index("audit_lead_idx").on(t.leadId),
  ],
);

// keep a reference so `sql` import is always used even if defaults change
export const __schemaMarker = sql`1`;
