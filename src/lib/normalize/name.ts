import { foldCroatian } from "./diacritics";

// Common accommodation/business suffixes & noise words to drop for matching.
const SUFFIXES = [
  "d.o.o.",
  "d.o.o",
  "doo",
  "obrt",
  "j.d.o.o.",
  "jdoo",
  "ltd",
  "llc",
  "inc",
  "gmbh",
];

const NOISE = [
  "apartmani",
  "apartments",
  "apartman",
  "apartment",
  "villa",
  "vila",
  "guesthouse",
  "guest",
  "house",
  "rooms",
  "sobe",
  "smjestaj",
  "accommodation",
  "holiday",
  "home",
  "homes",
  "kuca",
  "za",
  "odmor",
  "private",
  "privatni",
];

/**
 * Normalize a business name for comparison: fold diacritics, lowercase, drop
 * punctuation, remove legal suffixes and generic accommodation noise words,
 * collapse whitespace. This is a comparison key, not a display value.
 */
export function normalizeBusinessName(input: string): string {
  if (!input) return "";
  let s = foldCroatian(input).toLowerCase();
  s = s.replace(/[^a-z0-9\s.]/g, " ");

  for (const suf of SUFFIXES) {
    s = s.replace(new RegExp(`\\b${suf.replace(/\./g, "\\.")}\\b`, "g"), " ");
  }
  s = s.replace(/[.]/g, " ");

  const tokens = s
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t) => !NOISE.includes(t));

  return tokens.join(" ").trim();
}

/** Levenshtein distance for fuzzy (review-only) name matching. */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const prev = new Array<number>(n + 1);
  const curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        (prev[j] ?? 0) + 1,
        (curr[j - 1] ?? 0) + 1,
        (prev[j - 1] ?? 0) + cost,
      );
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j] ?? 0;
  }
  return prev[n] ?? 0;
}

/** Similarity ratio in [0,1] from normalized names. */
export function nameSimilarity(a: string, b: string): number {
  const na = normalizeBusinessName(a);
  const nb = normalizeBusinessName(b);
  if (!na && !nb) return 1;
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const dist = levenshtein(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  return maxLen === 0 ? 1 : 1 - dist / maxLen;
}
