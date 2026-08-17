import type { LeadAnalysis } from "@/agents/lead-finder/schema";
import { classifyLocation, type TerritoryBounds } from "./geo";
import { foldCroatian } from "./normalize/diacritics";
import { normalizeEmail } from "./normalize/email";

function canonicalToken(token: string): string {
  if (token.endsWith("ies") && token.length > 4) return `${token.slice(0, -3)}y`;
  if (token.endsWith("sses") && token.length > 5) return token.slice(0, -2);
  if (token.endsWith("s") && !token.endsWith("ss") && token.length > 4) {
    return token.slice(0, -1);
  }
  return token;
}

function canonicalTokens(text: string): string[] {
  return foldCroatian(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(canonicalToken);
}

function canonicalPhrase(text: string): string {
  return canonicalTokens(text).join(" ");
}

/** Match whole normalized tokens, never arbitrary substrings. */
export function deterministicExclusionMatch(exclusion: string, evidenceText: string): boolean {
  const exclusionTokens = canonicalTokens(exclusion);
  if (exclusionTokens.length === 0) return false;
  const evidenceTokens = canonicalTokens(evidenceText);
  if (evidenceTokens.length === 0) return false;

  const exclusionPhrase = exclusionTokens.join(" ");
  const evidencePhrase = evidenceTokens.join(" ");
  if (` ${evidencePhrase} `.includes(` ${exclusionPhrase} `)) return true;

  const evidenceSet = new Set(evidenceTokens);
  return exclusionTokens.length > 1 && exclusionTokens.every((token) => evidenceSet.has(token));
}

/** Generic qualification policy persisted with a territory/job request. */
export interface QualificationSettings {
  requirePublicEmail: boolean;
  requireWithinTerritory: boolean;
  requireWebsite: boolean;
  minConfidence: number;
}

export type QualificationOutcome = "qualified" | "manualReview" | "rejected";

export interface QualificationInput {
  analysis: LeadAnalysis;
  /** Emails deterministically extracted from the actual scraped page text. */
  sourceEmails: string[];
  bounds: TerritoryBounds;
  settings: QualificationSettings;
  /** Location text assembled from evidence for the hard geographic check. */
  locationText: string;
  /** Project-level business types to hard-reject (e.g. "hostel", "campsite"),
   * matched case/diacritic-insensitively against the candidate's business
   * type, its Google Places categories, and the model's own fact lists. */
  excludedBusinessTypes?: string[];
  /** Google Places category codes for the candidate (e.g. "campground"). */
  placeTypes?: string[];
}

export interface QualificationResult {
  outcome: QualificationOutcome;
  score: number;
  reasons: string[];
  rejectionReasons: string[];
  /** Trusted only when it appears verbatim in public source text. */
  verifiedEmail: string;
  geo: ReturnType<typeof classifyLocation>;
}

/**
 * Deterministic final checks. The model supplies structured project-fit
 * findings, but application code controls the accepted outcome and score.
 */
export function qualifyLead(input: QualificationInput): QualificationResult {
  const { analysis, sourceEmails, bounds, settings, locationText, excludedBusinessTypes = [], placeTypes = [] } = input;
  const reasons: string[] = [];
  const rejectionReasons: string[] = [];

  const normalizedSources = new Set(sourceEmails.map(normalizeEmail));
  const claimedEmail = normalizeEmail(analysis.publicEmail ?? "");
  const verifiedEmail =
    claimedEmail && normalizedSources.has(claimedEmail) ? claimedEmail : "";

  const geo = classifyLocation(locationText || analysis.location, bounds);
  let hardFail = false;

  // --- Project-specific exclusions (code decides, not the model) ------------
  // Matched against the model's own business type + fact lists and the
  // candidate's Google Places categories, so a project can rule out a class
  // of business (e.g. "hostel", "campsite") regardless of how the model scores it.
  if (excludedBusinessTypes.length > 0) {
    const evidenceText = [
      analysis.businessType,
      ...analysis.verifiedFacts,
      ...analysis.inferredFacts,
      ...analysis.fitReasons,
      ...placeTypes,
    ].join(" ");
    const deterministicMatch = excludedBusinessTypes.find((exclusion) =>
      deterministicExclusionMatch(exclusion, evidenceText),
    );
    const claimedMatch = analysis.matchesProjectExclusion
      ? canonicalPhrase(analysis.matchedProjectExclusion)
      : "";
    const verifiedModelMatch = claimedMatch
      ? excludedBusinessTypes.find(
          (exclusion) => canonicalPhrase(exclusion) === claimedMatch,
        )
      : undefined;
    const matched = deterministicMatch ?? verifiedModelMatch;
    if (matched) {
      rejectionReasons.push(`Matches project exclusion: "${matched}"`);
      hardFail = true;
    }
  }

  if (settings.requireWithinTerritory) {
    if (geo === "outside" || geo === "excluded") {
      rejectionReasons.push("Outside the selected territory");
      hardFail = true;
    } else if (geo === "ambiguous") {
      rejectionReasons.push("Location could not be confirmed within territory");
    }
  }

  if (settings.requirePublicEmail && !verifiedEmail) {
    rejectionReasons.push(
      claimedEmail
        ? "Email not found verbatim in public source text"
        : "No public business email found",
    );
    hardFail = true;
  }

  const hasWebsite = Boolean((analysis.website ?? "").trim());
  const hasEvidence = analysis.sourceEvidence.length > 0;
  if (settings.requireWebsite && !hasWebsite && !hasEvidence) {
    rejectionReasons.push("No credible public website or listing");
    hardFail = true;
  }

  if (!(analysis.businessType ?? "").trim()) {
    rejectionReasons.push("Business type could not be established");
    hardFail = true;
  }

  if (!hasEvidence) {
    rejectionReasons.push("Insufficient source evidence");
    hardFail = true;
  }

  if (!analysis.matchesIdealCustomer) {
    rejectionReasons.push(
      analysis.disqualifyingReasons[0] || "Does not match the project's ideal customer",
    );
    hardFail = true;
  }

  if (analysis.offerRelevance === "none") {
    rejectionReasons.push("No credible relevance to the project's offer");
    hardFail = true;
  } else if (analysis.offerRelevance === "weak") {
    rejectionReasons.push("Offer relevance is weak and requires manual review");
  }

  if (analysis.confidence < settings.minConfidence) {
    rejectionReasons.push(
      `Model confidence ${analysis.confidence.toFixed(2)} below threshold ${settings.minConfidence}`,
    );
  }

  let score = 0;
  const add = (label: string, points: number) => {
    reasons.push(label);
    score += points;
  };

  if (verifiedEmail) add("Verified public email", 20);
  if (geo === "inTerritory") add("Confirmed within territory", 20);
  if (analysis.matchesIdealCustomer) add("Matches the project's ideal customer", 25);
  if (analysis.offerRelevance === "strong") add("Strong offer relevance", 15);
  if (analysis.offerRelevance === "possible") add("Possible offer relevance", 8);
  if (analysis.offerRelevance === "weak") add("Weak offer relevance", 3);
  if (hasWebsite) add("Credible website", 10);
  if ((analysis.publicPhone ?? "").trim()) add("Public phone found", 5);
  score += Math.round(analysis.confidence * 5);
  score = Math.max(0, Math.min(100, score));

  let outcome: QualificationOutcome;
  if (hardFail) {
    outcome = "rejected";
  } else if (
    geo === "ambiguous" ||
    analysis.offerRelevance === "weak" ||
    analysis.confidence < settings.minConfidence
  ) {
    outcome = "manualReview";
  } else {
    outcome = "qualified";
  }

  return { outcome, score, reasons, rejectionReasons, verifiedEmail, geo };
}
