const EMAIL_RE =
  /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

/** Lowercase + trim. Gmail-style dot/plus folding is intentionally NOT applied
 * because business mailboxes often rely on exact local parts. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  const e = normalizeEmail(email);
  const single = new RegExp(`^${EMAIL_RE.source}$`);
  if (!single.test(e)) return false;
  // Reject obvious junk / role-less placeholders.
  if (e.includes("..")) return false;
  if (e.startsWith(".") || e.startsWith("@")) return false;
  return true;
}

/** Extract every plausible email from free text (used by deterministic
 * contact extraction from scraped page content). Deduplicated + normalized. */
export function extractEmails(text: string): string[] {
  const found = text.match(EMAIL_RE) ?? [];
  const cleaned = found
    .map((e) => normalizeEmail(e))
    // trailing punctuation sometimes captured (e.g. "info@x.com.")
    .map((e) => e.replace(/[.,;:)]+$/, ""))
    .filter(isValidEmail);
  return Array.from(new Set(cleaned));
}
