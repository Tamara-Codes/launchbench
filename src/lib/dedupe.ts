import { foldCroatian } from "./normalize/diacritics";
import { nameSimilarity } from "./normalize/name";

export type MatchType = "email" | "domain" | "phone" | "nameLocality" | "fuzzy";
export type MatchResolution = "confirmed" | "uncertain";

export interface CanonicalKeys {
  normalizedEmail: string;
  normalizedDomain: string;
  normalizedPhone: string;
  normalizedName: string;
  locality: string;
}

export interface KnownRecord extends CanonicalKeys {
  id: string;
}

export interface DuplicateMatch {
  matchedId: string;
  matchType: MatchType;
  resolution: MatchResolution;
  score: number;
  details: string;
}

const FUZZY_REVIEW_THRESHOLD = 0.8;

function sameLocality(a: string, b: string): boolean {
  const fa = foldCroatian(a).toLowerCase().trim();
  const fb = foldCroatian(b).toLowerCase().trim();
  if (!fa || !fb) return false;
  return fa === fb || fa.includes(fb) || fb.includes(fa);
}

/**
 * Find the strongest duplicate for `candidate` among `known` records.
 * Exact key matches (email/domain/phone, or name+locality) resolve as
 * `confirmed`. Strong-but-inexact name matches resolve as `uncertain`
 * (stored for manual review, never auto-merged). Returns null when nothing
 * meaningful matches.
 */
export function findDuplicate(
  candidate: CanonicalKeys,
  known: KnownRecord[],
): DuplicateMatch | null {
  let fuzzyBest: DuplicateMatch | null = null;

  for (const rec of known) {
    if (candidate.normalizedEmail && rec.normalizedEmail === candidate.normalizedEmail) {
      return {
        matchedId: rec.id,
        matchType: "email",
        resolution: "confirmed",
        score: 1,
        details: `Same email ${candidate.normalizedEmail}`,
      };
    }
    if (candidate.normalizedDomain && rec.normalizedDomain === candidate.normalizedDomain) {
      return {
        matchedId: rec.id,
        matchType: "domain",
        resolution: "confirmed",
        score: 0.98,
        details: `Same domain ${candidate.normalizedDomain}`,
      };
    }
    if (candidate.normalizedPhone && rec.normalizedPhone === candidate.normalizedPhone) {
      return {
        matchedId: rec.id,
        matchType: "phone",
        resolution: "confirmed",
        score: 0.95,
        details: `Same phone ${candidate.normalizedPhone}`,
      };
    }
    if (
      candidate.normalizedName &&
      rec.normalizedName === candidate.normalizedName &&
      sameLocality(candidate.locality, rec.locality)
    ) {
      return {
        matchedId: rec.id,
        matchType: "nameLocality",
        resolution: "confirmed",
        score: 0.9,
        details: `Same name "${candidate.normalizedName}" in ${candidate.locality}`,
      };
    }

    // Fuzzy — review only.
    if (candidate.normalizedName && rec.normalizedName) {
      const sim = nameSimilarity(candidate.normalizedName, rec.normalizedName);
      if (
        sim >= FUZZY_REVIEW_THRESHOLD &&
        sameLocality(candidate.locality, rec.locality) &&
        (!fuzzyBest || sim > fuzzyBest.score)
      ) {
        fuzzyBest = {
          matchedId: rec.id,
          matchType: "fuzzy",
          resolution: "uncertain",
          score: sim,
          details: `Similar name (${(sim * 100).toFixed(0)}%) in same locality`,
        };
      }
    }
  }

  return fuzzyBest;
}
