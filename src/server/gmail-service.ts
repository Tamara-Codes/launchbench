import "server-only";
import { and, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  auditLogs,
  emailDrafts,
  followUpRules,
  gmailConnection,
  leadStatusHistory,
  leads,
  scheduledFollowUps,
  sentEmails,
  type LeadStatus,
} from "@/db/schema";
import { composioGmail } from "@/providers/composio";
import { hasUnresolvedVariables } from "@/lib/templates";
import { followUpCancellation, planFollowUps } from "@/lib/followups";
import { normalizeEmail } from "@/lib/normalize/email";
import { safeErrorMessage } from "@/lib/redact";

const OPT_OUT_HINTS = [
  "unsubscribe",
  "opt out",
  "opt-out",
  "remove me",
  "stop emailing",
  "odjava",
  "odjaviti",
  "ne šaljite",
  "ne saljite",
  "ne želim",
  "ne zelim",
  "prestanite",
];

// In-process guard against double-click duplicate sends.
const sending = new Set<string>();

async function getConnection() {
  const [conn] = await db.select().from(gmailConnection).limit(1);
  return conn ?? null;
}

async function requireActiveConnection() {
  const conn = await getConnection();
  if (!conn || conn.status !== "active") {
    throw new Error("Gmail is not connected. Connect it in Settings → Gmail.");
  }
  return conn;
}

async function logLead(leadId: string, eventType: string, message: string) {
  const [lead] = await db.select({ t: leads.territoryId }).from(leads).where(eq(leads.id, leadId));
  await db.insert(auditLogs).values({
    eventType,
    entityType: "lead",
    entityId: leadId,
    leadId,
    territoryId: lead?.t ?? null,
    message,
  });
}

async function setLeadStatus(leadId: string, to: LeadStatus, reason: string) {
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));
  if (!lead) return;
  await db.transaction((tx) => {
    tx.update(leads).set({ status: to }).where(eq(leads.id, leadId)).run();
    tx.insert(leadStatusHistory)
      .values({ leadId, fromStatus: lead.status, toStatus: to, reason })
      .run();
  });
}

/** Create a Gmail draft for an email draft (no send). */
export async function createGmailDraft(draftId: string): Promise<{ gmailDraftId: string }> {
  const conn = await requireActiveConnection();
  const [draft] = await db.select().from(emailDrafts).where(eq(emailDrafts.id, draftId));
  if (!draft) throw new Error("Draft not found.");
  if (hasUnresolvedVariables(draft.subject) || hasUnresolvedVariables(draft.body)) {
    throw new Error("Draft has unresolved variables; resolve them before creating a Gmail draft.");
  }
  const res = await composioGmail.createDraft(
    conn.composioUserId,
    draft.recipientEmail,
    draft.subject,
    draft.body,
    draft.inReplyToThreadId || undefined,
  );
  await db
    .update(emailDrafts)
    .set({ status: "gmailDraftCreated" })
    .where(eq(emailDrafts.id, draftId));
  await logLead(draft.leadId, "email_draft_created", `Gmail draft created for ${draft.recipientEmail}.`);
  return { gmailDraftId: res.draftId };
}

/**
 * Send an approved draft via Gmail. Idempotent: if this draft's sendKey has
 * already been sent, returns the existing record without re-sending. Never
 * auto-retries an uncertain failure.
 */
export async function sendDraft(draftId: string): Promise<{ sentId: string; alreadySent: boolean }> {
  const [draft] = await db.select().from(emailDrafts).where(eq(emailDrafts.id, draftId));
  if (!draft) throw new Error("Draft not found.");

  // Idempotency: sendKey already recorded?
  const [existing] = await db
    .select()
    .from(sentEmails)
    .where(eq(sentEmails.sendKey, draft.sendKey))
    .limit(1);
  if (existing || draft.status === "sent") {
    return { sentId: existing?.id ?? "", alreadySent: true };
  }
  if (draft.status !== "approved") {
    throw new Error("Only approved drafts can be sent. Approve it first.");
  }
  if (hasUnresolvedVariables(draft.subject) || hasUnresolvedVariables(draft.body)) {
    throw new Error("Draft has unresolved variables; cannot send.");
  }
  if (sending.has(draftId)) {
    throw new Error("This draft is already being sent.");
  }

  const conn = await requireActiveConnection();
  sending.add(draftId);
  try {
    const res = await composioGmail.sendEmail(
      conn.composioUserId,
      draft.recipientEmail,
      draft.subject,
      draft.body,
      draft.inReplyToThreadId || undefined,
    );

    const [rules] = await db.select().from(followUpRules).limit(1);
    const now = new Date();

    const sentId = await db.transaction((tx) => {
      const [sent] = tx
        .insert(sentEmails)
        .values({
          leadId: draft.leadId,
          draftId: draft.id,
          emailType: draft.emailType,
          recipientEmail: draft.recipientEmail,
          subject: draft.subject,
          body: draft.body,
          gmailMessageId: res.messageId,
          gmailThreadId: res.threadId,
          sendKey: draft.sendKey,
          sentAt: now,
        })
        .returning()
        .all();

      tx.update(emailDrafts).set({ status: "sent", inReplyToThreadId: res.threadId }).where(eq(emailDrafts.id, draft.id)).run();

      const [lead] = tx.select().from(leads).where(eq(leads.id, draft.leadId)).all();
      const fromStatus = lead?.status ?? "approved";
      tx.update(leads)
        .set({ status: "contacted", lastContactedAt: now })
        .where(eq(leads.id, draft.leadId))
        .run();
      tx.insert(leadStatusHistory)
        .values({ leadId: draft.leadId, fromStatus, toStatus: "contacted", reason: `Sent ${draft.emailType}` })
        .run();

      // Schedule follow-ups only after the INITIAL email.
      if (draft.emailType === "initial" && rules) {
        const plan = planFollowUps(now, {
          firstFollowUpDays: rules.firstFollowUpDays,
          finalFollowUpDays: rules.finalFollowUpDays,
          maxFollowUps: rules.maxFollowUps,
          stopAfterReply: rules.stopAfterReply,
          stopAfterOptOut: rules.stopAfterOptOut,
          stopAfterInvalidAddress: rules.stopAfterInvalidAddress,
          stopAfterNotInterested: rules.stopAfterNotInterested,
        });
        for (const p of plan) {
          tx.insert(scheduledFollowUps)
            .values({ leadId: draft.leadId, sequence: p.sequence, emailType: p.emailType, dueAt: p.dueAt, status: "scheduled" })
            .run();
        }
        if (plan[0]) {
          tx.update(leads).set({ nextFollowUpAt: plan[0].dueAt }).where(eq(leads.id, draft.leadId)).run();
        }
      }
      return sent!.id;
    });

    await logLead(draft.leadId, "email_sent", `Email sent to ${draft.recipientEmail} (${draft.emailType}).`);
    return { sentId, alreadySent: false };
  } catch (err) {
    // Do NOT auto-retry an uncertain send. Surface the error.
    throw new Error(`Send failed (not retried): ${safeErrorMessage(err)}`);
  } finally {
    sending.delete(draftId);
  }
}

/** Manually check Gmail for replies to contacted leads and update state. */
export async function checkReplies(): Promise<{ repliesFound: number; optOuts: number }> {
  const conn = await requireActiveConnection();

  const contacted = await db
    .select()
    .from(leads)
    .where(
      inArray(leads.status, ["contacted", "followUpDue", "replied"]),
    );
  if (contacted.length === 0) {
    await db.update(gmailConnection).set({ lastReplyCheckAt: new Date() }).where(eq(gmailConnection.id, conn.id));
    return { repliesFound: 0, optOuts: 0 };
  }

  const byEmail = new Map<string, (typeof contacted)[number]>();
  for (const l of contacted) if (l.normalizedEmail) byEmail.set(l.normalizedEmail, l);

  const emails = Array.from(byEmail.keys());
  const query = `${emails.map((e) => `from:${e}`).join(" OR ")} newer_than:60d`;
  const messages = await composioGmail.fetchReplies(conn.composioUserId, query, 50);

  let repliesFound = 0;
  let optOuts = 0;

  for (const msg of messages) {
    const fromEmail = normalizeEmail((msg.from.match(/<([^>]+)>/)?.[1] ?? msg.from).trim());
    const lead = byEmail.get(fromEmail);
    if (!lead) continue;

    const text = `${msg.subject} ${msg.snippet}`.toLowerCase();
    const isOptOut = OPT_OUT_HINTS.some((h) => text.includes(h));
    const newStatus: LeadStatus = isOptOut ? "optedOut" : "replied";

    if (lead.status !== newStatus && lead.status !== "interested" && lead.status !== "customer") {
      await setLeadStatus(lead.id, newStatus, isOptOut ? "Opt-out detected in reply" : "Reply detected in Gmail");
      await db.insert(auditLogs).values({
        eventType: isOptOut ? "opt_out" : "reply_detected",
        entityType: "lead",
        entityId: lead.id,
        leadId: lead.id,
        territoryId: lead.territoryId,
        message: `${isOptOut ? "Opt-out" : "Reply"} from ${fromEmail}: ${msg.snippet.slice(0, 140)}`,
        metadata: { gmailThreadId: msg.threadId, gmailMessageId: msg.messageId },
      });
      // Cancel pending follow-ups per rules.
      await cancelFollowUpsForLead(lead.id, newStatus);
      if (isOptOut) optOuts++;
      else repliesFound++;
    }
  }

  await db.update(gmailConnection).set({ lastReplyCheckAt: new Date() }).where(eq(gmailConnection.id, conn.id));
  return { repliesFound, optOuts };
}

async function cancelFollowUpsForLead(leadId: string, status: LeadStatus) {
  const [rules] = await db.select().from(followUpRules).limit(1);
  if (!rules) return;
  const reason = followUpCancellation(status, {
    firstFollowUpDays: rules.firstFollowUpDays,
    finalFollowUpDays: rules.finalFollowUpDays,
    maxFollowUps: rules.maxFollowUps,
    stopAfterReply: rules.stopAfterReply,
    stopAfterOptOut: rules.stopAfterOptOut,
    stopAfterInvalidAddress: rules.stopAfterInvalidAddress,
    stopAfterNotInterested: rules.stopAfterNotInterested,
  });
  if (!reason) return;
  await db
    .update(scheduledFollowUps)
    .set({ status: reason, cancelledReason: `Lead status: ${status}` })
    .where(and(eq(scheduledFollowUps.leadId, leadId), inArray(scheduledFollowUps.status, ["scheduled", "due", "prepared"])));
  await db.update(leads).set({ nextFollowUpAt: null }).where(eq(leads.id, leadId));
}

/** Mark follow-ups that are due (dueAt <= now) as 'due'. */
export async function prepareDueFollowUps(): Promise<{ due: number }> {
  const now = new Date();
  const pending = await db
    .select()
    .from(scheduledFollowUps)
    .where(and(eq(scheduledFollowUps.status, "scheduled")));
  let due = 0;
  for (const f of pending) {
    if (f.dueAt <= now) {
      await db.update(scheduledFollowUps).set({ status: "due" }).where(eq(scheduledFollowUps.id, f.id));
      await db.update(leads).set({ status: "followUpDue" }).where(and(eq(leads.id, f.leadId), ne(leads.status, "replied")));
      due++;
    }
  }
  return { due };
}
