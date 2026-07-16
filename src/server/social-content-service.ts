import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { agents, contentAgentRuns, generatedImageAssets, mediaAssets, products, productSocialStrategies, socialContentItems } from "@/db/schema";
import { socialContentSchema, type SocialContentOutput } from "@/agents/social-content/schema";
import { gemini } from "@/providers/gemini";
import { agentModelSettings } from "@/lib/agent-models";
import { renderTemplate } from "@/lib/templates";
import { saveGeneratedSocialImage, storageAbsolutePath } from "@/lib/media-storage";

export type SocialGenerationMode = "caption" | "image" | "full";

export type SocialGenerationInput = {
  productId: string;
  contentType: string;
  format: "single_image" | "carousel" | "story";
  language?: string;
  extraInstruction?: string;
  referenceAssetIds?: string[];
  mode: SocialGenerationMode;
  variations?: number;
};

function historySummary(rows: Array<{ hook: string; contentType: string; caption: string }>) {
  if (!rows.length) return "No previous content is available for this product.";
  return rows.map((row) => `- ${row.contentType}: ${row.hook}\n  ${row.caption.slice(0, 180)}`).join("\n");
}

export async function generateSocialContent(input: SocialGenerationInput) {
  const [product, agent] = await Promise.all([
    db.select().from(products).where(eq(products.id, input.productId)).then((r) => r[0]),
    db.select().from(agents).where(eq(agents.slug, "social-content-agent")).then((r) => r[0]),
  ]);
  if (!product) throw new Error("Product not found.");
  if (!agent?.enabled) throw new Error("Content Agent is disabled. Enable it on the Agents page first.");
  const settings = agentModelSettings(agent.configuration, agent.model, "gemini");
  if (!gemini.isConfigured()) throw new Error("GEMINI_API_KEY is not configured on the server.");
  if (input.mode !== "caption" && !gemini.isConfigured()) throw new Error("GEMINI_API_KEY is not configured on the server for image generation.");

  const [strategy, recent, selectedAssets] = await Promise.all([
    db.select().from(productSocialStrategies).where(eq(productSocialStrategies.productId, product.id)).then((r) => r[0]),
    db.select({ hook: socialContentItems.hook, contentType: socialContentItems.contentType, caption: socialContentItems.caption })
      .from(socialContentItems).where(eq(socialContentItems.productId, product.id)).orderBy(desc(socialContentItems.createdAt)).limit(12),
    input.referenceAssetIds?.length
      ? db.select().from(mediaAssets).where(and(eq(mediaAssets.productId, product.id), inArray(mediaAssets.id, input.referenceAssetIds)))
      : db.select().from(mediaAssets).where(and(eq(mediaAssets.productId, product.id), eq(mediaAssets.isPreferredReference, true))).limit(4),
  ]);
  const run = db.insert(contentAgentRuns).values({
    agentId: agent.id, productId: product.id, actionType: input.mode,
    inputSummary: `${input.contentType} / ${input.format} / ${input.language ?? product.preferredLanguage}`,
  }).returning().get();

  try {
    const referenceSummary = selectedAssets.length
      ? selectedAssets.map((asset) => `${asset.fileName} (${asset.tags.join(", ") || "untagged"})`).join("; ")
      : "No reference media selected. Create a truthful lifestyle visual without inventing product details.";
    const prompt = renderTemplate(agent.taskPromptTemplate, {
      product_name: product.name,
      product_context: [product.fullDescription, product.coreBenefit, product.socialMediaNotes, product.contentDos, product.contentDonts].filter(Boolean).join("\n"),
      target_audience: strategy?.primaryAudience || product.targetCustomer,
      platform: strategy?.primaryPlatform || "instagram",
      format: input.format,
      content_type: input.contentType === "surprise" ? "Choose the most useful non-repetitive type" : input.contentType,
      language: input.language || strategy?.preferredLanguage || product.preferredLanguage || "hr",
      extra_instruction: input.extraInstruction || "None.",
      recent_content_history: historySummary(recent),
      reference_media_summary: referenceSummary,
    });
    const output = await gemini.generateStructured<SocialContentOutput>({
      model: agent.model,
      systemPrompt: agent.systemPrompt,
      prompt: `${prompt.text}\n\nProduct voice: ${strategy?.brandVoice || product.brandVoice || "Natural, concise, and helpful."}\nCore messages: ${(strategy?.coreMessages ?? []).join(" | ")}\nContent pillars: ${(strategy?.contentPillars ?? []).map((pillar) => `${pillar.name}: ${pillar.purpose}`).join(" | ")}\nPreferred CTAs: ${(strategy?.preferredCtas ?? []).join(" | ")}\nVisual directions: ${(strategy?.visualDirections ?? []).join(" | ")}\nProhibited claims: ${(strategy?.prohibitedClaims ?? []).join(" | ")}\nBanned phrases: ${(strategy?.bannedPhrases ?? []).join(" | ")}\nHashtag guidance: ${strategy?.hashtagGuidance || "Use a concise relevant set."}\nAdvanced strategy context: ${strategy?.advancedContext || "None."}\nNever mix this product’s audience or messaging with another product.`,
      schema: socialContentSchema,
      schemaName: "social_content",
      temperature: agent.temperature,
    });
    const count = Math.max(1, Math.min(input.variations ?? 1, 3));
    const items = [];
    for (let i = 0; i < count; i++) {
      const [item] = await db.insert(socialContentItems).values({
        productId: product.id, sourceAgentId: agent.id, platform: output.platform, format: output.format,
        contentType: output.content_type, hook: output.hook, caption: output.caption, cta: output.cta,
        hashtags: output.hashtags, imagePrompt: output.image_prompt, onImageText: output.on_image_text,
        visualDirection: output.visual_direction, carouselPlan: output.carousel_plan, language: output.language,
        status: input.mode === "image" ? "idea" : "generated",
      }).returning();
      if (!item) continue;
      if (input.mode !== "caption") {
        const image = selectedAssets.length
          ? await gemini.editImage({ model: settings.imageModel || "gemini-3.1-flash-image", prompt: output.image_prompt, referencePaths: selectedAssets.map((asset) => storageAbsolutePath(asset.filePath)), size: "1024x1536", quality: "medium" })
          : await gemini.generateImage({ model: settings.imageModel || "gemini-3.1-flash-image", prompt: output.image_prompt, size: "1024x1536", quality: "medium" });
        const filePath = await saveGeneratedSocialImage(product.id, image.bytes);
        await db.insert(generatedImageAssets).values({
          socialContentItemId: item.id, productId: product.id, filePath, prompt: output.image_prompt,
          provider: image.provider, model: image.model, responseMetadata: image.metadata,
          generationSettings: { size: "1024x1536", quality: "medium", mode: selectedAssets.length ? "edit" : "generate" },
          referenceAssetIds: selectedAssets.map((asset) => asset.id),
        });
      }
      items.push(item);
    }
    await db.update(contentAgentRuns).set({ status: "completed", outputSummary: `${items.length} content item(s) created.`, completedAt: new Date() }).where(eq(contentAgentRuns.id, run.id));
    return items;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Social content generation failed.";
    await db.update(contentAgentRuns).set({ status: "failed", error: message, completedAt: new Date() }).where(eq(contentAgentRuns.id, run.id));
    throw error;
  }
}
