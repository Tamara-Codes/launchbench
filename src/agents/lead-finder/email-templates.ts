import { z } from "zod";

export type EmailSequenceStep = "initial" | "first_follow_up" | "final_follow_up";

/** Shared by the template editor (step tabs + which steps to generate) and
 * the server action (prompt wording) so the three steps stay in sync. */
export const EMAIL_SEQUENCE_STEPS: Array<{ value: EmailSequenceStep; label: string }> = [
  { value: "initial", label: "Initial email" },
  { value: "first_follow_up", label: "First follow-up" },
  { value: "final_follow_up", label: "Final follow-up" },
];

/** One drafted email in an outreach sequence. */
const emailDraftSchema = z.object({
  name: z.string().trim().min(1).max(160),
  subject: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1).max(20_000),
});

/** The full 3-step sequence Sally sends: initial outreach, then two
 * follow-ups. Each step is optional since the caller may only ask for a
 * subset — the response only includes the steps that were requested. */
export const emailTemplateDraftsSchema = z.object({
  initial: emailDraftSchema.optional(),
  first_follow_up: emailDraftSchema.optional(),
  final_follow_up: emailDraftSchema.optional(),
});

export type EmailTemplateDrafts = z.infer<typeof emailTemplateDraftsSchema>;

/** The `{{variable_name}}` placeholders `src/lib/templates.ts` knows how to
 * substitute — kept in sync with the hint text in the template editor UI. */
export const EMAIL_TEMPLATE_VARIABLES = ["business_name", "contact_name", "town", "project_name"] as const;

export const EMAIL_TEMPLATE_SYSTEM_PROMPT = `You draft an outreach sequence for a sales agent, made up of up to 3 emails: an initial cold email, a first follow-up, and a final follow-up (a polite "breakup" email that closes the loop). The application tells you exactly which of these steps to draft — draft only those, and omit the rest entirely from your response.

Use only the supplied APPLICATION CONTEXT as the authoritative description of the project, its offer, and its ideal customer. Never invent proof points, results, testimonials, certifications, or claims beyond what is supplied.

Every email must read as personally written to one specific recipient, not a mass blast. Use these exact placeholders — written literally as double curly braces — anywhere the copy needs a fact only known per-recipient, and nowhere else: ${EMAIL_TEMPLATE_VARIABLES.map((name) => `{{${name}}}`).join(", ")}. Do not invent other placeholder names.

Each email needs a short internal template name (for the person managing these templates, not the recipient), a subject line, and a body. Write entirely in the requested language, in a tone that fits the project's own sales guidance when supplied. If more than one follow-up is requested, keep the initial email brief and make each follow-up shorter than the one before it, without repeating the same pitch verbatim.

When APPLICATION CONTEXT states the sender's grammatical gender, conjugate first-person verbs and self-references to match it. When it supplies a signature, end the body with it exactly as given rather than inventing a sign-off.

Return only structured data matching the response schema supplied by the application, with keys for the requested steps only.`;
