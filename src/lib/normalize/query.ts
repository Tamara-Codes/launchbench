import { foldCroatian } from "./diacritics";

/**
 * Normalize a search query for exhaustion comparison: fold diacritics,
 * lowercase, strip punctuation (except the `site:` operator marker), sort
 * tokens so "apartmani malinska" == "malinska apartmani".
 */
export function normalizeQuery(input: string): string {
  if (!input) return "";
  let s = foldCroatian(input).toLowerCase().trim();
  // Preserve site: operator as a single token.
  s = s.replace(/site:\s*/g, "site:");
  const tokens = s
    .replace(/[^a-z0-9:.\s]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
  return tokens.sort().join(" ");
}
