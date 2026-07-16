import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  appSettings,
  emailDrafts,
  emailTemplates,
  leads,
  products,
  type EmailType,
} from "@/db/schema";
import { newId } from "@/lib/ids";
import { renderTemplate, type TemplateVars } from "@/lib/templates";
import { isValidEmail } from "@/lib/normalize/email";

const TYPE_LABELS: Record<EmailType, string> = {
  initial: "Initial outreach",
  follow_up_1: "First follow-up",
  follow_up_final: "Final follow-up",
  reply: "Reply",
};

/** Pick the best verified, lead-specific fact for {{verified_observation}}.
 * Only VERIFIED facts are used — never inferred/invented content. */
function verifiedObservation(lead: typeof leads.$inferSelect): string {
  const facts = lead.facts.verifiedFacts ?? [];
  return facts[0] ?? "";
}

export interface GenerateDraftResult {
  draftId: string;
  unresolved: string[];
  warnings: string[];
}

/**
 * Generate an email draft for a lead using the editable template for the given
 * type + the lead's language. Personalization uses only stored, verified facts
 * and configured product/sender identity — nothing is invented.
 */
export async function generateDraft(
  leadId: string,
  emailType: EmailType,
  languageOverride?: string,
): Promise<GenerateDraftResult> {
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));
  if (!lead) throw new Error("Lead not found.");
  if (!lead.email || !isValidEmail(lead.email)) {
    throw new Error("Lead has no valid public email; cannot generate outreach.");
  }

  const [settings] = await db.select().from(appSettings).limit(1);
  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.active, true))
    .limit(1);

  const language = languageOverride || lead.languagePreference || "hr";

  const [template] = await db
    .select()
    .from(emailTemplates)
    .where(
      and(
        eq(emailTemplates.emailType, emailType),
        eq(emailTemplates.language, language),
        eq(emailTemplates.active, true),
      ),
    )
    .orderBy(desc(emailTemplates.version))
    .limit(1);
  if (!template) {
    throw new Error(
      `No active ${language} template for ${TYPE_LABELS[emailType]}. Create one in Settings → Templates.`,
    );
  }

  const vars: TemplateVars = {
    business_name: lead.businessName,
    town: lead.town,
    verified_observation: verifiedObservation(lead),
    product_name: product?.name ?? "",
    sender_name: settings?.senderName ?? "",
    sender_company: settings?.senderCompany ?? "",
    demo_url: product?.demoUrl ?? "",
    website_url: product?.websiteUrl ?? "",
    price_text: product?.priceText ?? "",
  };

  const subjectR = renderTemplate(template.subject, vars);
  const bodyBase = renderTemplate(template.body, vars);
  const signature = settings?.senderSignature ?? "";
  const body = signature ? `${bodyBase.text}\n\n${signature}` : bodyBase.text;

  const unresolved = Array.from(
    new Set([...subjectR.unresolved, ...bodyBase.unresolved]),
  );

  const warnings: string[] = [];
  if (unresolved.length)
    warnings.push(`Unresolved variables: ${unresolved.join(", ")}. Resolve before sending.`);
  if (!vars.verified_observation)
    warnings.push("No verified lead-specific fact available for personalization.");

  const sourceFactsUsed = vars.verified_observation
    ? [String(vars.verified_observation)]
    : [];

  const [draft] = await db
    .insert(emailDrafts)
    .values({
      leadId,
      emailType,
      language,
      recipientEmail: lead.email,
      subject: subjectR.text,
      body,
      status: "draft",
      unresolvedVariables: unresolved,
      sourceFactsUsed,
      warnings,
      sendKey: `${leadId}:${emailType}:${newId()}`,
    })
    .returning();

  return { draftId: draft!.id, unresolved, warnings };
}
