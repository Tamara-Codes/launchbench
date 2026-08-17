import "server-only";
import { z } from "zod";
import { gemini } from "@/providers/gemini";
import { getEnv } from "@/env";

export const sallySearchPlanSchema = z.object({
  textQueries: z.array(z.string().trim().min(2).max(120)).min(4).max(10),
  countries: z.array(z.string().trim().min(2).max(120)).max(20),
});

export type SallySearchPlan = z.infer<typeof sallySearchPlanSchema>;

export type SallySearchPlanInput = {
  name: string;
  fullDescription: string;
  targetCustomer: string;
  coreBenefit: string;
  exclusions: string[];
  countries: string[];
  observationMetadata?: Record<string, unknown>;
};

export async function generateSallySearchPlan(
  input: SallySearchPlanInput,
): Promise<SallySearchPlan> {
  if (!gemini.isConfigured()) {
    throw new Error("GEMINI_API_KEY is required to generate Sally's search plan.");
  }

  const countries = Array.from(new Set(input.countries.map((country) => country.trim()).filter(Boolean)));
  const plan = await gemini.generateStructured({
    model: getEnv().GEMINI_MODEL,
    systemPrompt: `You create concise Google Places Text Search plans for B2B lead discovery.

Return exactly eight distinct business-category queries. Queries must describe businesses, not locations. Do not include a town, country, "near me", or placeholders. Include useful local-language variants for the supplied countries and useful English variants. Prefer phrases a real business would be listed under on Google Maps. Do not include excluded business types. Return only structured JSON.`,
    prompt: [
      `Project: ${input.name}`,
      `What it is: ${input.fullDescription}`,
      `Ideal customer: ${input.targetCustomer}`,
      `Main benefit: ${input.coreBenefit}`,
      `Excluded businesses: ${input.exclusions.join(", ") || "(none)"}`,
      `Territory countries: ${countries.join(", ") || "(not selected yet; use English plus the most likely market-language variants only when strongly implied)"}`,
    ].join("\n"),
    schema: sallySearchPlanSchema,
    schemaName: "sally_google_places_search_plan",
    observationName: "sally.generate-search-plan",
    observationMetadata: input.observationMetadata,
    temperature: 0,
  });

  return sallySearchPlanSchema.parse({ ...plan, countries });
}
