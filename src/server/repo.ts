import "server-only";
import { existsSync, statSync } from "node:fs";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db, dbFilePath } from "@/db";
import {
  agents,
  agentPromptVersions,
  appSettings,
  auditLogs,
  discoveredCandidates,
  duplicateMatches,
  emailDrafts,
  emailTemplates,
  followUpRules,
  gmailConnection,
  leadSources,
  leadStatusHistory,
  leads,
  mediaAssets,
  products,
  productSocialStrategies,
  scheduledFollowUps,
  searchRuns,
  sentEmails,
  socialContentItems,
  territories,
  type LeadStatus,
  type SocialContentStatus,
} from "@/db/schema";

// --------------------------------------------------------------------------
// Settings / territory / product
// --------------------------------------------------------------------------
export async function getSettings() {
  const [s] = await db.select().from(appSettings).limit(1);
  return s ?? null;
}

export async function listTerritories() {
  return db.select().from(territories).orderBy(desc(territories.active), territories.town);
}

export async function getActiveTerritory() {
  const s = await getSettings();
  if (s?.activeTerritoryId) {
    const [t] = await db.select().from(territories).where(eq(territories.id, s.activeTerritoryId));
    if (t) return t;
  }
  const [t] = await db.select().from(territories).where(eq(territories.active, true)).limit(1);
  return t ?? null;
}

export async function getTerritory(id: string) {
  const [t] = await db.select().from(territories).where(eq(territories.id, id));
  return t ?? null;
}

export async function getActiveProduct() {
  const [p] = await db.select().from(products).where(eq(products.active, true)).limit(1);
  if (p) return p;
  const [any] = await db.select().from(products).limit(1);
  return any ?? null;
}

export async function listProducts() {
  return db.select().from(products).orderBy(desc(products.active), products.name);
}

export async function getProduct(id: string) {
  const [product] = await db.select().from(products).where(eq(products.id, id));
  return product ?? null;
}

export async function getProductSocialStrategy(productId: string) {
  const [strategy] = await db.select().from(productSocialStrategies).where(eq(productSocialStrategies.productId, productId));
  return strategy ?? null;
}

export async function listProductSocialStrategies() {
  return db.select({ product: products, strategy: productSocialStrategies })
    .from(products)
    .leftJoin(productSocialStrategies, eq(productSocialStrategies.productId, products.id))
    .orderBy(products.name);
}

// --------------------------------------------------------------------------
// Media library
// --------------------------------------------------------------------------
export async function listMediaAssets(productId?: string) {
  return db
    .select({ asset: mediaAssets, product: products })
    .from(mediaAssets)
    .innerJoin(products, eq(products.id, mediaAssets.productId))
    .where(productId ? eq(mediaAssets.productId, productId) : undefined)
    .orderBy(desc(mediaAssets.createdAt))
    .limit(300);
}

// --------------------------------------------------------------------------
// Social content
// --------------------------------------------------------------------------
export interface SocialContentFilter {
  productId?: string;
  status?: SocialContentStatus;
  includeArchived?: boolean;
}

export async function listSocialContent(filter: SocialContentFilter = {}) {
  const conditions = [];
  if (filter.productId) conditions.push(eq(socialContentItems.productId, filter.productId));
  if (filter.status) conditions.push(eq(socialContentItems.status, filter.status));
  if (!filter.includeArchived && !filter.status) conditions.push(sql`${socialContentItems.status} != 'archived'`);

  return db
    .select({ item: socialContentItems, product: products })
    .from(socialContentItems)
    .leftJoin(products, eq(products.id, socialContentItems.productId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(socialContentItems.scheduledFor), desc(socialContentItems.createdAt))
    .limit(500);
}

// --------------------------------------------------------------------------
// Agents
// --------------------------------------------------------------------------
export async function listAgents() {
  return db.select().from(agents).orderBy(agents.name);
}

export async function getAgentBySlug(slug: string) {
  const [a] = await db.select().from(agents).where(eq(agents.slug, slug));
  return a ?? null;
}

export async function getAgentVersions(agentId: string) {
  return db
    .select()
    .from(agentPromptVersions)
    .where(eq(agentPromptVersions.agentId, agentId))
    .orderBy(desc(agentPromptVersions.version));
}

// --------------------------------------------------------------------------
// Runs
// --------------------------------------------------------------------------
export async function listRuns(limit = 50, productId?: string) {
  return db
    .select({
      run: searchRuns,
      town: territories.town,
    })
    .from(searchRuns)
    .leftJoin(territories, eq(territories.id, searchRuns.territoryId))
    .where(productId ? eq(searchRuns.productId, productId) : undefined)
    .orderBy(desc(searchRuns.createdAt))
    .limit(limit);
}

export async function getRun(id: string) {
  const [r] = await db.select().from(searchRuns).where(eq(searchRuns.id, id));
  return r ?? null;
}

export async function getRunEvents(runId: string, limit = 200) {
  return db
    .select()
    .from(auditLogs)
    .where(and(eq(auditLogs.entityId, runId), eq(auditLogs.eventType, "run_event")))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
}

export async function getRunCandidateBreakdown(runId: string) {
  const rows = await db
    .select({ outcome: discoveredCandidates.outcome, c: sql<number>`count(*)` })
    .from(discoveredCandidates)
    .where(eq(discoveredCandidates.runId, runId))
    .groupBy(discoveredCandidates.outcome);
  const map: Record<string, number> = {};
  for (const r of rows) map[r.outcome] = Number(r.c);
  return map;
}

// --------------------------------------------------------------------------
// Leads
// --------------------------------------------------------------------------
export interface LeadFilter {
  productId?: string;
  territoryId?: string;
  status?: LeadStatus;
  hasEmail?: boolean;
  search?: string;
}

export async function listLeads(filter: LeadFilter = {}) {
  const conds = [];
  if (filter.territoryId) conds.push(eq(leads.territoryId, filter.territoryId));
  if (filter.status) conds.push(eq(leads.status, filter.status));
  if (filter.hasEmail) conds.push(sql`${leads.normalizedEmail} != ''`);
  const rows = filter.productId
    ? (await db
        .select({ lead: leads })
        .from(leads)
        .innerJoin(searchRuns, eq(searchRuns.id, leads.runId))
        .where(and(...conds, eq(searchRuns.productId, filter.productId)))
        .orderBy(desc(leads.createdAt))
        .limit(500)).map((row) => row.lead)
    : await db
        .select()
        .from(leads)
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(desc(leads.createdAt))
        .limit(500);
  if (filter.search) {
    const q = filter.search.toLowerCase();
    return rows.filter(
      (l) =>
        l.businessName.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        l.town.toLowerCase().includes(q),
    );
  }
  return rows;
}

export async function getLeadDetail(id: string) {
  const [lead] = await db.select().from(leads).where(eq(leads.id, id));
  if (!lead) return null;
  const [sources, history, drafts, sent, followUps, dups] = await Promise.all([
    db.select().from(leadSources).where(eq(leadSources.leadId, id)),
    db.select().from(leadStatusHistory).where(eq(leadStatusHistory.leadId, id)).orderBy(desc(leadStatusHistory.createdAt)),
    db.select().from(emailDrafts).where(eq(emailDrafts.leadId, id)).orderBy(desc(emailDrafts.createdAt)),
    db.select().from(sentEmails).where(eq(sentEmails.leadId, id)).orderBy(desc(sentEmails.sentAt)),
    db.select().from(scheduledFollowUps).where(eq(scheduledFollowUps.leadId, id)).orderBy(scheduledFollowUps.dueAt),
    db.select().from(duplicateMatches).where(eq(duplicateMatches.leadId, id)),
  ]);
  return { lead, sources, history, drafts, sent, followUps, dups };
}

export async function leadStatusCounts(territoryId?: string, productId?: string) {
  const rows = await db
    .select({ status: leads.status, c: sql<number>`count(*)` })
    .from(leads)
    .innerJoin(searchRuns, eq(searchRuns.id, leads.runId))
    .where(and(territoryId ? eq(leads.territoryId, territoryId) : undefined, productId ? eq(searchRuns.productId, productId) : undefined))
    .groupBy(leads.status);
  const map: Record<string, number> = {};
  for (const r of rows) map[r.status] = Number(r.c);
  return map;
}

// --------------------------------------------------------------------------
// Email queue / templates
// --------------------------------------------------------------------------
export async function listDrafts(statuses?: string[], productId?: string) {
  const rows = await db
    .select({ draft: emailDrafts, lead: leads })
    .from(emailDrafts)
    .leftJoin(leads, eq(leads.id, emailDrafts.leadId))
    .leftJoin(searchRuns, eq(searchRuns.id, leads.runId))
    .where(and(statuses?.length ? inArray(emailDrafts.status, statuses as any) : undefined, productId ? eq(searchRuns.productId, productId) : undefined))
    .orderBy(desc(emailDrafts.createdAt))
    .limit(200);
  return rows;
}

export async function listTemplates() {
  return db.select().from(emailTemplates).orderBy(emailTemplates.emailType, emailTemplates.language);
}

// --------------------------------------------------------------------------
// Follow-ups
// --------------------------------------------------------------------------
export async function getFollowUpRules() {
  const [r] = await db.select().from(followUpRules).limit(1);
  return r ?? null;
}

export async function listFollowUps(productId?: string) {
  return db
    .select({ f: scheduledFollowUps, lead: leads })
    .from(scheduledFollowUps)
    .leftJoin(leads, eq(leads.id, scheduledFollowUps.leadId))
    .leftJoin(searchRuns, eq(searchRuns.id, leads.runId))
    .where(productId ? eq(searchRuns.productId, productId) : undefined)
    .orderBy(scheduledFollowUps.dueAt)
    .limit(300);
}

// --------------------------------------------------------------------------
// Gmail
// --------------------------------------------------------------------------
export async function getGmailConnection() {
  const [c] = await db.select().from(gmailConnection).limit(1);
  return c ?? null;
}

// --------------------------------------------------------------------------
// Dashboard aggregate
// --------------------------------------------------------------------------
export async function getRecentActivity(limit = 20) {
  return db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(limit);
}

export async function getDashboardData(productId?: string) {
  const territory = await getActiveTerritory();
  const settings = await getSettings();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const pipeline = await leadStatusCounts(territory?.id, productId);
  const [{ contactedToday } = { contactedToday: 0 }] = await db
    .select({ contactedToday: sql<number>`count(*)` })
    .from(sentEmails)
    .innerJoin(leads, eq(leads.id, sentEmails.leadId))
    .innerJoin(searchRuns, eq(searchRuns.id, leads.runId))
    .where(and(gte(sentEmails.sentAt, startOfToday), productId ? eq(searchRuns.productId, productId) : undefined));

  const leadsToday = await db
    .select({ c: sql<number>`count(*)` })
    .from(leads)
    .innerJoin(searchRuns, eq(searchRuns.id, leads.runId))
    .where(and(gte(leads.createdAt, startOfToday), territory ? eq(leads.territoryId, territory.id) : sql`1=1`, productId ? eq(searchRuns.productId, productId) : undefined));

  const [lastRunRow] = await db
    .select()
    .from(searchRuns)
    .where(productId ? eq(searchRuns.productId, productId) : undefined)
    .orderBy(desc(searchRuns.createdAt))
    .limit(1);

  const followUpRows = await db.select({ followUp: scheduledFollowUps }).from(scheduledFollowUps)
    .innerJoin(leads, eq(leads.id, scheduledFollowUps.leadId))
    .innerJoin(searchRuns, eq(searchRuns.id, leads.runId))
    .where(and(inArray(scheduledFollowUps.status, ["scheduled", "due"]), productId ? eq(searchRuns.productId, productId) : undefined));
  const followUps = followUpRows.map((row) => row.followUp);

  const now = new Date();
  const [[readyContent], [scheduledContent], nextContent] = await Promise.all([
    db.select({ c: sql<number>`count(*)` }).from(socialContentItems).where(and(inArray(socialContentItems.status, ["generated", "approved"]), productId ? eq(socialContentItems.productId, productId) : undefined)),
    db.select({ c: sql<number>`count(*)` }).from(socialContentItems).where(and(eq(socialContentItems.status, "scheduled"), gte(socialContentItems.scheduledFor, now), productId ? eq(socialContentItems.productId, productId) : undefined)),
    db.select({ item: socialContentItems, product: products }).from(socialContentItems).leftJoin(products, eq(products.id, socialContentItems.productId)).where(and(eq(socialContentItems.status, "scheduled"), gte(socialContentItems.scheduledFor, now), productId ? eq(socialContentItems.productId, productId) : undefined)).orderBy(socialContentItems.scheduledFor).limit(1),
  ]);

  const activity = await getRecentActivity(12);

  return {
    territory,
    settings,
    pipeline,
    qualifiedToday: Number(leadsToday[0]?.c ?? 0),
    emailsSentToday: Number(contactedToday ?? 0),
    lastRun: lastRunRow ?? null,
    followUps,
    social: {
      readyForReview: Number(readyContent?.c ?? 0),
      scheduled: Number(scheduledContent?.c ?? 0),
      next: nextContent[0] ?? null,
    },
    activity,
  };
}

export async function getDataStats() {
  let sizeBytes = 0;
  try {
    if (existsSync(dbFilePath)) sizeBytes = statSync(dbFilePath).size;
  } catch {
    /* ignore */
  }
  const [[leadCount], [runCount], [sentCount], settings] = await Promise.all([
    db.select({ c: sql<number>`count(*)` }).from(leads),
    db.select({ c: sql<number>`count(*)` }).from(searchRuns),
    db.select({ c: sql<number>`count(*)` }).from(sentEmails),
    getSettings(),
  ]);
  return {
    dbFilePath,
    sizeBytes,
    totalLeads: Number(leadCount?.c ?? 0),
    totalRuns: Number(runCount?.c ?? 0),
    totalSent: Number(sentCount?.c ?? 0),
    lastBackupAt: settings?.lastBackupAt ?? null,
    lastBackupPath: settings?.lastBackupPath ?? "",
  };
}

export async function getDailyLeadSeries(days = 14, territoryId?: string, productId?: string) {
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);
  const rows = await db
    .select({ createdAt: leads.createdAt })
    .from(leads)
    .innerJoin(searchRuns, eq(searchRuns.id, leads.runId))
    .where(and(gte(leads.createdAt, since), territoryId ? eq(leads.territoryId, territoryId) : sql`1=1`, productId ? eq(searchRuns.productId, productId) : undefined));
  const buckets = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    buckets.set(d.toISOString().slice(0, 10), 0);
  }
  for (const r of rows) {
    const key = r.createdAt.toISOString().slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return Array.from(buckets.entries()).map(([date, count]) => ({ date, count }));
}
