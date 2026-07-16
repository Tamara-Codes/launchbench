import { z } from "zod";

export const socialContentSchema = z.object({
  hook: z.string().min(1).max(500),
  caption: z.string().min(1).max(8_000),
  cta: z.string().max(500).default(""),
  hashtags: z.array(z.string().max(120)).max(30).default([]),
  on_image_text: z.string().max(500).default(""),
  visual_direction: z.string().min(1).max(2_000),
  image_prompt: z.string().min(1).max(4_000),
  content_type: z.string().min(1).max(160),
  platform: z.literal("instagram").default("instagram"),
  format: z.enum(["single_image", "carousel", "story"]),
  language: z.string().min(2).max(12),
  carousel_plan: z.array(z.string().max(1_000)).max(10).default([]),
});

export type SocialContentOutput = z.infer<typeof socialContentSchema>;
