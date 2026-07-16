import { foldCroatian } from "./normalize/diacritics";

export type GeoMatch = "inTerritory" | "excluded" | "ambiguous" | "outside";

export interface TerritoryBounds {
  town: string;
  includedSettlements: string[];
  excludedSettlements: string[];
}

function fold(s: string): string {
  return foldCroatian(s).toLowerCase().trim();
}

/** Croatian stem: drop trailing case-ending vowels / soft consonant so that
 * declined forms match ("Malinska" -> "malinsk" matches "Malinskoj"). Short
 * names (<=4 chars, e.g. "Krk") are matched exactly to avoid over-matching. */
function stem(place: string): string {
  const p = fold(place);
  if (p.length <= 4) return p;
  return p.replace(/[aeiouj]+$/, "");
}

/** Does `text` mention the place (diacritic- and declension-insensitive)? */
function mentions(text: string, place: string): boolean {
  const p = fold(place).trim();
  if (!p) return false;
  const foldedText = fold(text);

  // Multi-word settlement: match the whole phrase as a normalized substring.
  if (p.includes(" ")) {
    const collapsed = foldedText.replace(/[^a-z0-9]+/g, " ");
    return collapsed.includes(p);
  }

  const st = stem(place);
  const tokens = foldedText.split(/[^a-z0-9]+/).filter(Boolean);
  for (const tok of tokens) {
    if (tok === p) return true;
    if (st.length >= 4 && (tok === st || tok.startsWith(st))) return true;
  }
  return false;
}

/**
 * Decide whether evidence text places a candidate inside the hard territory
 * boundary. The town and any explicitly included settlements count as inside.
 * Excluded settlements (and only those) count as outside. When the town is not
 * mentioned but the location field is non-empty, the result is `ambiguous`
 * (manual review) — never silently accepted, never silently expanded.
 */
export function classifyLocation(
  locationText: string,
  bounds: TerritoryBounds,
): GeoMatch {
  const text = locationText ?? "";
  if (!text.trim()) return "ambiguous";

  for (const ex of bounds.excludedSettlements) {
    if (ex && mentions(text, ex)) return "excluded";
  }

  if (mentions(text, bounds.town)) return "inTerritory";
  for (const inc of bounds.includedSettlements) {
    if (inc && mentions(text, inc)) return "inTerritory";
  }

  return "ambiguous";
}

export function isInTerritory(
  locationText: string,
  bounds: TerritoryBounds,
): boolean {
  return classifyLocation(locationText, bounds) === "inTerritory";
}
