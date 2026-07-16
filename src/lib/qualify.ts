import type { LeadAnalysis } from "@/agents/lead-finder/schema";
import { classifyLocation, type TerritoryBounds } from "./geo";
import { normalizeEmail } from "./normalize/email";

/** Qualification policy persisted with a Supabase territory/job request. */
export interface QualificationSettings {
  requirePublicEmail: boolean;
  requireWithinTerritory: boolean;
  requireWebsite: boolean;
  requireIndependent: boolean;
  minConfidence: number;
  rejectExistingDigitalGuide: boolean;
}

export type QualificationOutcome = "qualified" | "manualReview" | "rejected";

export interface QualificationInput {
  analysis: LeadAnalysis;
  /** Emails deterministically extracted from the actual scraped page text. */
  sourceEmails: string[];
  bounds: TerritoryBounds;
  settings: QualificationSettings;
  /** Location string assembled from evidence (used for hard geo check). */
  locationText: string;
}

export interface QualificationResult {
  outcome: QualificationOutcome;
  score: number;
  reasons: string[];
  rejectionReasons: string[];
  /** The email we trust — only if it appears verbatim in source text. */
  verifiedEmail: string;
  geo: ReturnType<typeof classifyLocation>;
}

/**
 * Mandatory qualification checks implemented in application code. Gemini's
 * reasoning/confidence is advisory only; the decision to accept a lead is made
 * here. An email is trusted ONLY when it appears verbatim in the scraped page
 * text (defends against model-invented addresses).
 */
export function qualifyLead(input: QualificationInput): QualificationResult {
  const { analysis, sourceEmails, bounds, settings, locationText } = input;
  const reasons: string[] = [];
  const rejectionReasons: string[] = [];

  const normalizedSources = new Set(sourceEmails.map(normalizeEmail));
  const claimedEmail = normalizeEmail(analysis.publicEmail ?? "");
  const verifiedEmail =
    claimedEmail && normalizedSources.has(claimedEmail) ? claimedEmail : "";

  // --- Hard geographic boundary (code decides, not the model) ---------------
  const geo = classifyLocation(locationText || analysis.location, bounds);

  let hardFail = false;

  if (settings.requireWithinTerritory) {
    if (geo === "outside" || geo === "excluded") {
      rejectionReasons.push("Outside the selected territory");
      hardFail = true;
    } else if (geo === "ambiguous") {
      rejectionReasons.push("Location could not be confirmed within territory");
    }
  }

  // --- Public email (verbatim in source) ------------------------------------
  if (settings.requirePublicEmail) {
    if (!verifiedEmail) {
      rejectionReasons.push(
        claimedEmail
          ? "Email not found verbatim in public source text"
          : "No public business email found",
      );
      hardFail = true;
    }
  }

  // --- Website / directory listing ------------------------------------------
  const hasWebsite = Boolean((analysis.website ?? "").trim());
  const hasEvidence = (analysis.sourceEvidence ?? []).length > 0;
  if (settings.requireWebsite && !hasWebsite && !hasEvidence) {
    rejectionReasons.push("No credible public website or listing");
    hardFail = true;
  }

  // --- Operates accommodation & plausibly benefits --------------------------
  const type = (analysis.accommodationType ?? "").toLowerCase();
  const looksLikeAccommodation =
    Boolean(type) ||
    analysis.estimatedUnits != null ||
    analysis.qualificationReasons.length > 0;
  if (!looksLikeAccommodation) {
    rejectionReasons.push("Does not clearly operate tourist accommodation");
    hardFail = true;
  }

  if (!hasEvidence) {
    rejectionReasons.push("Insufficient source evidence");
    hardFail = true;
  }

  // --- Confidence floor ------------------------------------------------------
  if (analysis.confidence < settings.minConfidence) {
    rejectionReasons.push(
      `Model confidence ${analysis.confidence.toFixed(2)} below threshold ${settings.minConfidence}`,
    );
  }

  // --- Positive scoring ------------------------------------------------------
  let score = 0;
  const add = (label: string, pts: number) => {
    reasons.push(label);
    score += pts;
  };
  if (verifiedEmail) add("Verified public email", 20);
  if (geo === "inTerritory") add("Confirmed within territory", 20);
  if ((analysis.estimatedUnits ?? 0) >= 2) add("Multiple accommodation units", 10);
  if (analysis.directBooking) add("Direct booking present", 10);
  if ((analysis.languages ?? []).length >= 2) add("Multilingual website", 8);
  if (analysis.internationalGuestsLikely) add("International guests likely", 8);
  if (hasWebsite) add("Credible website", 8);
  if (!analysis.existingDigitalGuideDetected) add("No existing digital guide", 10);
  else rejectionReasons.push("Existing sophisticated digital guide detected");
  score += Math.round(analysis.confidence * 6);

  // --- Existing digital guide (configurable hard reject) --------------------
  if (settings.rejectExistingDigitalGuide && analysis.existingDigitalGuideDetected) {
    rejectionReasons.push("Rejecting: existing digital guide");
    hardFail = true;
  }

  score = Math.max(0, Math.min(100, score));

  let outcome: QualificationOutcome;
  if (hardFail) {
    outcome = "rejected";
  } else if (
    geo === "ambiguous" ||
    analysis.confidence < settings.minConfidence
  ) {
    // Ambiguous location or low confidence => manual review, does NOT count
    // toward the qualified-lead target.
    outcome = "manualReview";
  } else {
    outcome = "qualified";
  }

  return { outcome, score, reasons, rejectionReasons, verifiedEmail, geo };
}
