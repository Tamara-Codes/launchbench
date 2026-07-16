"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "./tenant-context";

type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
const productSchema = z.object({
  name: z.string().trim().min(1).max(160),
  shortDescription: z.string().max(500).default(""),
  fullDescription: z.string().max(8_000).default(""),
  targetCustomer: z.string().max(3_000).default(""),
  coreBenefit: z.string().max(3_000).default(""),
  priceText: z.string().max(500).default(""),
  demoUrl: z.string().max(2_000).default(""),
  websiteUrl: z.string().max(2_000).default(""),
  emailGenerationContext: z.string().max(5_000).default(""),
  preferredLanguage: z.string().trim().min(2).max(12).default("hr"),
});

const templateSchema = z.object({
  productId: z.string().uuid(),
  language: z.string().trim().min(2).max(12),
  sequenceStep: z.enum(["initial", "first_follow_up", "final_follow_up"]),
  name: z.string().trim().min(1).max(160),
  subject: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1).max(20_000),
});
const workspaceSettingsSchema = z.object({
  senderName: z.string().trim().max(160).default(""),
  senderCompany: z.string().trim().max(160).default(""),
  senderEmail: z.string().trim().email().or(z.literal("")),
  senderSignature: z.string().max(5_000).default(""),
  dailyLeadTarget: z.number().int().min(1).max(100).default(10),
});

function failure(error: unknown): ActionResult<never> {
  return { ok: false, error: error instanceof Error ? error.message : "Something went wrong." };
}

export async function createTenantProduct(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const values = productSchema.parse(input);
    const context = await getTenantContext();
    if (!context) throw new Error("Create a workspace before adding products.");
    if (context.role === "member") throw new Error("Only workspace owners and admins can add products.");
    const supabase = await createClient();
    const { data, error } = await supabase.from("products").insert({
      workspace_id: context.workspace.id,
      name: values.name,
      short_description: values.shortDescription,
      full_description: values.fullDescription,
      target_customer: values.targetCustomer,
      core_benefit: values.coreBenefit,
      price_text: values.priceText,
      demo_url: values.demoUrl,
      website_url: values.websiteUrl,
      email_generation_context: values.emailGenerationContext,
      preferred_language: values.preferredLanguage,
    }).select("id").single();
    if (error || !data) throw new Error(error?.message ?? "Could not create product.");
    revalidatePath("/app/products");
    return { ok: true, data: { id: data.id } };
  } catch (error) { return failure(error); }
}

export async function updateTenantProduct(id: string, input: unknown): Promise<ActionResult> {
  try {
    const values = productSchema.parse(input);
    const context = await getTenantContext();
    if (!context) throw new Error("Not authorized.");
    if (context.role === "member") throw new Error("Only workspace owners and admins can edit products.");
    const supabase = await createClient();
    const { error } = await supabase.from("products").update({
      name: values.name,
      short_description: values.shortDescription,
      full_description: values.fullDescription,
      target_customer: values.targetCustomer,
      core_benefit: values.coreBenefit,
      price_text: values.priceText,
      demo_url: values.demoUrl,
      website_url: values.websiteUrl,
      email_generation_context: values.emailGenerationContext,
      preferred_language: values.preferredLanguage,
    }).eq("id", id).eq("workspace_id", context.workspace.id);
    if (error) throw new Error(error.message);
    revalidatePath(`/app/products/${id}`);
    revalidatePath("/app/products");
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
      product_id: values.productId,
      language: values.language,
      sequence_step: values.sequenceStep,
      name: values.name,
      subject: values.subject,
      body: values.body,
    }, { onConflict: "product_id,language,sequence_step" });
    if (error) throw new Error(error.message);
    revalidatePath(`/app/products/${values.productId}`);
    return { ok: true };
  } catch (error) { return failure(error); }
}

export async function updateTenantWorkspaceSettings(input: unknown): Promise<ActionResult> {
  try {
    const values = workspaceSettingsSchema.parse(input);
    const context = await getTenantContext();
    if (!context) throw new Error("Not authorized.");
    if (context.role === "member") throw new Error("Only workspace owners and admins can edit workspace settings.");
    const supabase = await createClient();
    const { error } = await supabase.from("workspace_settings").update({
      sender_name: values.senderName,
      sender_company: values.senderCompany,
      sender_email: values.senderEmail,
      sender_signature: values.senderSignature,
      daily_lead_target: values.dailyLeadTarget,
    }).eq("workspace_id", context.workspace.id);
    if (error) throw new Error(error.message);
    revalidatePath("/app/settings");
    return { ok: true };
  } catch (error) { return failure(error); }
}
