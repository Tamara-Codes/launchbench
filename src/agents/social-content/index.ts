import "server-only";
import { z } from "zod";
import type { AgentDefinition, AgentRunContext } from "@/agents/types";
import { generateSocialContent, type SocialGenerationInput } from "@/server/social-content-service";

const inputSchema = z.object({
  productId: z.string().min(1),
  contentType: z.string().min(1),
  format: z.enum(["single_image", "carousel", "story"]),
  language: z.string().default("hr"),
  extraInstruction: z.string().default(""),
  referenceAssetIds: z.array(z.string()).default([]),
  mode: z.enum(["caption", "image", "full"]),
  variations: z.number().int().min(1).max(3).default(1),
});

class SocialContentAgent implements AgentDefinition<SocialGenerationInput, { ids: string[] }> {
  slug = "social-content-agent";
  agentType = "content_creator";

  validateInput(input: unknown): SocialGenerationInput {
    return inputSchema.parse(input);
  }

  async execute(ctx: AgentRunContext<SocialGenerationInput>) {
    const items = await generateSocialContent(ctx.input);
    await ctx.emit({ stage: "completed", message: `Created ${items.length} social content item(s).` });
    return { ids: items.map((item) => item.id) };
  }
}

export const socialContentAgent = new SocialContentAgent();
