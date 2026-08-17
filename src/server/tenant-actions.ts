"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateSallySearchPlan, type SallySearchPlan } from "@/agents/lead-finder/search-plan";
import { getEnv } from "@/env";
import { gemini } from "@/providers/gemini";
import { EMAIL_SEQUENCE_STEPS, EMAIL_TEMPLATE_SYSTEM_PROMPT, emailTemplateDraftsSchema, type EmailTemplateDrafts } from "@/agents/lead-finder/email-templates";
import { safeErrorMessage } from "@/lib/redact";
import { recordIntegrationEvent } from "./tenant-observability";
import { getTenantContext } from "./tenant-context";

type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
const projectSchema = z.object({
  name: z.string().trim().min(1).max(160),
  fullDescription: z.string().trim().min(1).max(8_000),
  targetCustomer: z.string().trim().min(1).max(3_000),
  coreBenefit: z.string().trim().min(1).max(3_000),
  websiteUrl: z.string().max(2_000).default(""),
  emailGenerationContext: z.string().max(5_000).default(""),
  senderGender: z.enum(["female", "male"]).default("female"),
  senderSignature: z.string().max(1_000).default(""),
  excludedBusinessTypes: z.string().max(3_000).default(""),
  searchTerms: z.array(z.string().trim().min(1).max(200)).max(30).optional(),
  brandVoice: z.string().max(3_000).default(""),
  socialMediaNotes: z.string().max(5_000).default(""),
  visualStyle: z.string().max(3_000).default(""),
  preferredCta: z.string().max(1_000).default(""),
  contentDos: z.string().max(3_000).default(""),
  contentDonts: z.string().max(3_000).default(""),
  preferredLanguage: z.string().trim().min(2).max(12).default("hr"),
});

const emailPersonaSchema = z.object({
  projectId: z.string().uuid(),
  emailGenerationContext: z.string().max(5_000).default(""),
  preferredCta: z.string().max(1_000).default(""),
  senderGender: z.enum(["female", "male"]).default("female"),
  senderSignature: z.string().max(1_000).default(""),
});

const templateSchema = z.object({
  projectId: z.string().uuid(),
  language: z.string().trim().min(2).max(12),
  sequenceStep: z.enum(["initial", "first_follow_up", "final_follow_up"]),
  name: z.string().trim().min(1).max(160),
  subject: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1).max(20_000),
});
const templateDraftInputSchema = z.object({
  projectId: z.string().uuid(),
  language: z.string().trim().min(2).max(12),
  steps: z.array(z.enum(["initial", "first_follow_up", "final_follow_up"])).min(1).max(3),
});
function failure(error: unknown): ActionResult<never> {
  return { ok: false, error: error instanceof Error ? error.message : "Something went wrong." };
}

export async function createTenantProject(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const values = projectSchema.parse(input);
    const context = await getTenantContext();
    if (!context) throw new Error("Create a workspace before adding projects.");
    if (context.role === "member") throw new Error("Only workspace owners and admins can add projects.");
    const exclusions = values.excludedBusinessTypes.split(/\r?\n/).map((term) => term.trim()).filter(Boolean);
    const planStartedAt = Date.now();
    let searchPlan: SallySearchPlan;
    try {
      searchPlan = await generateSallySearchPlan({
        name: values.name,
        fullDescription: values.fullDescription,
        targetCustomer: values.targetCustomer,
        coreBenefit: values.coreBenefit,
        exclusions,
        countries: [],
        observationMetadata: { workspaceId: context.workspace.id, trigger: "project_created" },
      });
    } catch (error) {
      await recordIntegrationEvent({ workspaceId: context.workspace.id, provider: "gemini", operation: "generate_sally_search_plan", status: "failure", durationMs: Date.now() - planStartedAt, message: safeErrorMessage(error), metadata: { trigger: "project_created" } });
      throw error;
    }
    const supabase = await createClient();
    const { data, error } = await supabase.from("projects").insert({
      workspace_id: context.workspace.id,
      name: values.name,
      full_description: values.fullDescription,
      target_customer: values.targetCustomer,
      core_benefit: values.coreBenefit,
      website_url: values.websiteUrl,
      email_generation_context: values.emailGenerationContext,
      sender_gender: values.senderGender,
      sender_signature: values.senderSignature,
      lead_search_terms: searchPlan.textQueries,
      lead_search_plan: searchPlan,
      lead_search_plan_generated_at: new Date().toISOString(),
      exclusions,
      brand_voice: values.brandVoice,
      social_media_notes: values.socialMediaNotes,
      visual_style: values.visualStyle,
      preferred_cta: values.preferredCta,
      content_dos: values.contentDos,
      content_donts: values.contentDonts,
      preferred_language: values.preferredLanguage,
    }).select("id").single();
    if (error || !data) throw new Error(error?.message ?? "Could not create project.");
    await recordIntegrationEvent({ workspaceId: context.workspace.id, projectId: data.id, provider: "gemini", operation: "generate_sally_search_plan", status: "success", durationMs: Date.now() - planStartedAt, metadata: { trigger: "project_created", countries: searchPlan.countries, textQueries: searchPlan.textQueries } });
    revalidatePath("/app/projects");
    return { ok: true, data: { id: data.id } };
  } catch (error) { return failure(error); }
}

export async function updateTenantProject(id: string, input: unknown): Promise<ActionResult> {
  try {
    const values = projectSchema.parse(input);
    const context = await getTenantContext();
    if (!context) throw new Error("Not authorized.");
    if (context.role === "member") throw new Error("Only workspace owners and admins can edit projects.");
    const supabase = await createClient();
    const [{ data: existing, error: existingError }, { data: territories, error: territoriesError }] = await Promise.all([
      supabase.from("projects").select("name,full_description,target_customer,core_benefit,exclusions,lead_search_plan,lead_search_plan_generated_at").eq("id", id).eq("workspace_id", context.workspace.id).maybeSingle(),
      supabase.from("territories").select("country").eq("project_id", id).eq("workspace_id", context.workspace.id),
    ]);
    if (existingError || !existing) throw new Error(existingError?.message ?? "Project not found.");
    if (territoriesError) throw new Error(territoriesError.message);
    const exclusions = values.excludedBusinessTypes.split(/\r?\n/).map((term) => term.trim()).filter(Boolean);
    const existingExclusions = Array.isArray(existing.exclusions) ? existing.exclusions.map(String) : [];
    const searchContextChanged =
      existing.name !== values.name ||
      existing.full_description !== values.fullDescription ||
      existing.target_customer !== values.targetCustomer ||
      existing.core_benefit !== values.coreBenefit ||
      JSON.stringify(existingExclusions) !== JSON.stringify(exclusions);
    const shouldRegenerateSearchPlan = searchContextChanged || !existing.lead_search_plan_generated_at;
    const existingPlan = existing.lead_search_plan && typeof existing.lead_search_plan === "object" ? existing.lead_search_plan as SallySearchPlan : null;
    const manualSearchTerms =
      !shouldRegenerateSearchPlan && values.searchTerms && JSON.stringify(values.searchTerms) !== JSON.stringify(existingPlan?.textQueries ?? [])
        ? values.searchTerms
        : null;
    const planStartedAt = Date.now();
    let searchPlan: SallySearchPlan | null = null;
    if (shouldRegenerateSearchPlan) {
      try {
        searchPlan = await generateSallySearchPlan({
          name: values.name,
          fullDescription: values.fullDescription,
          targetCustomer: values.targetCustomer,
          coreBenefit: values.coreBenefit,
          exclusions,
          countries: Array.from(new Set((territories ?? []).map((territory) => territory.country))),
          observationMetadata: { workspaceId: context.workspace.id, projectId: id, trigger: searchContextChanged ? "project_context_changed" : "missing_saved_plan" },
        });
      } catch (error) {
        await recordIntegrationEvent({ workspaceId: context.workspace.id, projectId: id, provider: "gemini", operation: "generate_sally_search_plan", status: "failure", durationMs: Date.now() - planStartedAt, message: safeErrorMessage(error), metadata: { trigger: searchContextChanged ? "project_context_changed" : "missing_saved_plan" } });
        throw error;
      }
    }
    const { error } = await supabase.from("projects").update({
      name: values.name,
      full_description: values.fullDescription,
      target_customer: values.targetCustomer,
      core_benefit: values.coreBenefit,
      website_url: values.websiteUrl,
      email_generation_context: values.emailGenerationContext,
      sender_gender: values.senderGender,
      sender_signature: values.senderSignature,
      ...(searchPlan ? {
        lead_search_terms: searchPlan.textQueries,
        lead_search_plan: searchPlan,
        lead_search_plan_generated_at: new Date().toISOString(),
      } : manualSearchTerms ? {
        lead_search_terms: manualSearchTerms,
        lead_search_plan: { ...existingPlan, textQueries: manualSearchTerms },
      } : {}),
      exclusions,
      brand_voice: values.brandVoice,
      social_media_notes: values.socialMediaNotes,
      visual_style: values.visualStyle,
      preferred_cta: values.preferredCta,
      content_dos: values.contentDos,
      content_donts: values.contentDonts,
      preferred_language: values.preferredLanguage,
    }).eq("id", id).eq("workspace_id", context.workspace.id);
    if (error) throw new Error(error.message);
    if (searchPlan) {
      await recordIntegrationEvent({ workspaceId: context.workspace.id, projectId: id, provider: "gemini", operation: "generate_sally_search_plan", status: "success", durationMs: Date.now() - planStartedAt, metadata: { trigger: searchContextChanged ? "project_context_changed" : "missing_saved_plan", countries: searchPlan.countries, textQueries: searchPlan.textQueries } });
    }
    revalidatePath(`/app/projects/${id}`);
    revalidatePath("/app/projects");
    return { ok: true };
  } catch (error) { return failure(error); }
}

/** Sender identity and sales guidance shown on the Email templates tab,
 * right next to where those emails actually get drafted. */
export async function updateProjectEmailPersona(input: unknown): Promise<ActionResult> {
  try {
    const values = emailPersonaSchema.parse(input);
    const context = await getTenantContext();
    if (!context) throw new Error("Not authorized.");
    if (context.role === "member") throw new Error("Only workspace owners and admins can edit email direction.");
    const supabase = await createClient();
    const { error } = await supabase.from("projects").update({
      email_generation_context: values.emailGenerationContext,
      preferred_cta: values.preferredCta,
      sender_gender: values.senderGender,
      sender_signature: values.senderSignature,
    }).eq("id", values.projectId).eq("workspace_id", context.workspace.id);
    if (error) throw new Error(error.message);
    revalidatePath(`/app/projects/${values.projectId}/templates`);
    revalidatePath(`/app/projects/${values.projectId}`);
    return { ok: true };
  } catch (error) { return failure(error); }
}

export async function saveTenantEmailTemplate(input: unknown): Promise<ActionResult> {
  try {
    const values = templateSchema.parse(input);
    const context = await getTenantContext();
    if (!context) throw new Error("Not authorized.");
    if (context.role === "member") throw new Error("Only workspace owners and admins can edit templates.");
    const supabase = await createClient();
    const { error } = await supabase.from("email_templates").upsert({
      workspace_id: context.workspace.id,
      project_id: values.projectId,
      language: values.language,
      sequence_step: values.sequenceStep,
      name: values.name,
      subject: values.subject,
      body: values.body,
    }, { onConflict: "project_id,language,sequence_step" });
    if (error) throw new Error(error.message);
    revalidatePath(`/app/projects/${values.projectId}`);
    return { ok: true };
  } catch (error) { return failure(error); }
}

/** Drafts the outreach sequence for review. Nothing is saved automatically. */
export async function generateTenantEmailTemplateDrafts(input: unknown): Promise<ActionResult<EmailTemplateDrafts>> {
  try {
    const values = templateDraftInputSchema.parse(input);
    const context = await getTenantContext();
    if (!context) throw new Error("Not authorized.");
    if (context.role === "member") throw new Error("Only workspace owners and admins can generate templates.");
    if (!gemini.isConfigured()) throw new Error("GEMINI_API_KEY is not configured on the server.");
    const supabase = await createClient();
    const { data: project } = await supabase.from("projects")
      .select("name, full_description, target_customer, core_benefit, website_url, email_generation_context, preferred_cta, sender_gender, sender_signature")
      .eq("id", values.projectId)
      .eq("workspace_id", context.workspace.id)
      .maybeSingle();
    if (!project) throw new Error("Project not found.");
    const requestedLabels = EMAIL_SEQUENCE_STEPS.filter((step) => values.steps.includes(step.value)).map((step) => step.label);
    const prompt = [
      "APPLICATION CONTEXT (trusted):",
      `Project: ${project.name}`,
      `What it is: ${project.full_description}`,
      `Ideal customer: ${project.target_customer}`,
      `Main benefit: ${project.core_benefit}`,
      project.website_url && `Website: ${project.website_url}`,
      project.email_generation_context && `Proof points to emphasize: ${project.email_generation_context}`,
      project.preferred_cta && `Preferred call to action: ${project.preferred_cta}`,
      `The email is signed by a ${project.sender_gender} sender; write any first-person grammar (verb conjugation, self-reference) to match that gender.`,
      project.sender_signature && `End the email with this signature, used verbatim: ${project.sender_signature}`,
      `Write the sequence entirely in this language: ${values.language}.`,
      `Draft only these steps, and no others: ${requestedLabels.join(", ")}.`,
    ].filter(Boolean).join("\n");
    const drafts = await gemini.generateStructured({
      model: getEnv().GEMINI_MODEL,
      systemPrompt: EMAIL_TEMPLATE_SYSTEM_PROMPT,
      prompt,
      schema: emailTemplateDraftsSchema,
      schemaName: "sally_email_template_drafts",
      temperature: 0.4,
      maxOutputTokens: 16384,
    });
    return { ok: true, data: drafts };
  } catch (error) { return failure(error); }
}
