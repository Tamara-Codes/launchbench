/**
 * Normalize phone numbers to E.164-ish digits for comparison.
 * Defaults undecorated national numbers to the Croatia country code (+385).
 * Returns "" when there aren't enough digits to be a real number.
 */
export function normalizePhone(input: string, defaultCountry = "385"): string {
  if (!input) return "";
  const trimmed = input.trim();
  const hasPlus = trimmed.startsWith("+") || trimmed.startsWith("00");
  let digits = trimmed.replace(/[^\d]/g, "");
  if (trimmed.startsWith("00")) digits = digits.replace(/^00/, "");

  if (digits.length < 6) return "";

  if (hasPlus) {
    // E.164 numbers never exceed 15 digits total; longer runs are digit
    // soup (ids, timestamps) that happened to be prefixed with a "+"/"00".
    if (digits.length > 15) return "";
    return `+${digits}`;
  }

  // National format. Croatian numbers are often written "091 234 5678" or
  // "0912345678" with a trunk "0". Strip the trunk 0 and prepend country code.
  // Reject longer bare digit runs outright — those are never a national
  // number and are almost always an id or timestamp misread as one.
  if (digits.length > 11) return "";
  if (digits.startsWith(defaultCountry)) {
    return `+${digits}`;
  }
  const national = digits.replace(/^0+/, "");
  if (!national) return "";
  return `+${defaultCountry}${national}`;
}

const TEL_RE = /(?:\+?\d[\d\s().\-/]{6,}\d)/g;

/** Extract candidate phone numbers from text / `tel:` links. */
export function extractPhones(text: string, defaultCountry = "385"): string[] {
  const raw = text.match(TEL_RE) ?? [];
  const normalized = raw
    // A bare, unformatted digit run with no "+"/"00" prefix and no spacing
    // is almost never a real phone number as printed on a page — it's the
    // signature of an image filename, cache-busting timestamp, or tracking
    // id inside a URL matching the same regex. Real phone numbers on pages
    // are formatted (spaces/dashes/dots/parens) or carry a country prefix.
    .filter((r) => r.startsWith("+") || r.startsWith("00") || /[\s().\-/]/.test(r))
    .map((r) => normalizePhone(r, defaultCountry))
    .filter((r) => r.length >= 8 && r.length <= 16);
  return Array.from(new Set(normalized));
}
