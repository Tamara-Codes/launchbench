import { z } from "zod";

/** Source evidence entry — every important fact must be backed by a URL + snippet. */
export const sourceEvidenceSchema = z.object({
  url: z.string(),
  field: z.string(),
  snippet: z.string(),
});

/** Strict schema for the Gemini structured analysis of a single candidate.
 * Every response is validated against this before it can influence the DB. */
export const leadAnalysisSchema = z.object({
  businessName: z.string(),
  accommodationType: z.string(),
  location: z.string(),
  isInTargetLocation: z.boolean(),
  website: z.string(),
  publicEmail: z.string(),
  publicPhone: z.string(),
  estimatedUnits: z.number().int().nonnegative().nullable(),
  languages: z.array(z.string()),
  directBooking: z.boolean(),
  internationalGuestsLikely: z.boolean(),
  existingDigitalGuideDetected: z.boolean(),
  qualificationReasons: z.array(z.string()),
  rejectionReasons: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  verifiedFacts: z.array(z.string()),
  inferredFacts: z.array(z.string()),
  unknownFields: z.array(z.string()),
  sourceEvidence: z.array(sourceEvidenceSchema),
});

export type LeadAnalysis = z.infer<typeof leadAnalysisSchema>;

/**
 * The Gemini `responseSchema` (OpenAPI-style) matching leadAnalysisSchema.
 * `@google/genai` accepts a plain JSON schema object for responseSchema.
 */
export const geminiResponseSchema = {
  type: "object",
  properties: {
    businessName: { type: "string" },
    accommodationType: { type: "string" },
    location: { type: "string" },
    isInTargetLocation: { type: "boolean" },
    website: { type: "string" },
    publicEmail: { type: "string" },
    publicPhone: { type: "string" },
    estimatedUnits: { type: "integer", nullable: true },
    languages: { type: "array", items: { type: "string" } },
    directBooking: { type: "boolean" },
    internationalGuestsLikely: { type: "boolean" },
    existingDigitalGuideDetected: { type: "boolean" },
    qualificationReasons: { type: "array", items: { type: "string" } },
    rejectionReasons: { type: "array", items: { type: "string" } },
    confidence: { type: "number" },
    verifiedFacts: { type: "array", items: { type: "string" } },
    inferredFacts: { type: "array", items: { type: "string" } },
    unknownFields: { type: "array", items: { type: "string" } },
    sourceEvidence: {
      type: "array",
      items: {
        type: "object",
        properties: {
          url: { type: "string" },
          field: { type: "string" },
          snippet: { type: "string" },
        },
        required: ["url", "field", "snippet"],
      },
    },
  },
  required: [
    "businessName",
    "accommodationType",
    "location",
    "isInTargetLocation",
    "website",
    "publicEmail",
    "publicPhone",
    "languages",
    "directBooking",
    "internationalGuestsLikely",
    "existingDigitalGuideDetected",
    "qualificationReasons",
    "rejectionReasons",
    "confidence",
    "verifiedFacts",
    "inferredFacts",
    "unknownFields",
    "sourceEvidence",
  ],
} as const;
