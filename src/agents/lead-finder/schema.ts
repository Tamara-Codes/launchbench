import { z } from "zod";

/** Source evidence entry — every important fact must be backed by a URL + snippet. */
export const sourceEvidenceSchema = z.object({
  url: z.string(),
  field: z.string(),
  snippet: z.string(),
});

/**
 * Project-neutral analysis of one candidate. The selected project's context
 * defines what "ideal customer" and "offer relevance" mean for each call.
 */
export const leadAnalysisSchema = z.object({
  businessName: z.string(),
  businessType: z.string(),
  location: z.string(),
  website: z.string(),
  publicEmail: z.string(),
  publicPhone: z.string(),
  matchesProjectExclusion: z.boolean(),
  matchedProjectExclusion: z.string(),
  matchesIdealCustomer: z.boolean(),
  offerRelevance: z.enum(["strong", "possible", "weak", "none"]),
  fitReasons: z.array(z.string()),
  disqualifyingReasons: z.array(z.string()),
  emailDraft: z.object({
    subject: z.string(),
    body: z.string(),
  }),
  confidence: z.number().min(0).max(1),
  verifiedFacts: z.array(z.string()),
  inferredFacts: z.array(z.string()),
  unknownFields: z.array(z.string()),
  sourceEvidence: z.array(sourceEvidenceSchema),
});

export type LeadAnalysis = z.infer<typeof leadAnalysisSchema>;

/**
 * Cheap triage result computed from name/category/address alone, before any
 * page is scraped or the full evidence-based analysis runs.
 */
export const prefilterSchema = z.object({
  worthFullReview: z.boolean(),
  reason: z.string(),
});

export type PrefilterResult = z.infer<typeof prefilterSchema>;

/** OpenAPI-style response schema accepted by `@google/genai`. */
export const geminiResponseSchema = {
  type: "object",
  properties: {
    businessName: { type: "string" },
    businessType: { type: "string" },
    location: { type: "string" },
    website: { type: "string" },
    publicEmail: { type: "string" },
    publicPhone: { type: "string" },
    matchesProjectExclusion: { type: "boolean" },
    matchedProjectExclusion: { type: "string" },
    matchesIdealCustomer: { type: "boolean" },
    offerRelevance: {
      type: "string",
      enum: ["strong", "possible", "weak", "none"],
    },
    fitReasons: { type: "array", items: { type: "string" } },
    disqualifyingReasons: { type: "array", items: { type: "string" } },
    emailDraft: {
      type: "object",
      properties: {
        subject: { type: "string" },
        body: { type: "string" },
      },
      required: ["subject", "body"],
    },
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
    "businessType",
    "location",
    "website",
    "publicEmail",
    "publicPhone",
    "matchesProjectExclusion",
    "matchedProjectExclusion",
    "matchesIdealCustomer",
    "offerRelevance",
    "fitReasons",
    "disqualifyingReasons",
    "emailDraft",
    "confidence",
    "verifiedFacts",
    "inferredFacts",
    "unknownFields",
    "sourceEvidence",
  ],
} as const;
