/** Normalize a domain or a URL down to its bare registrable host:
 * lowercased, protocol/path/query stripped, leading `www.` removed. */
export function normalizeDomain(input: string): string {
  let s = input.trim().toLowerCase();
  if (!s) return "";
  // Strip scheme.
  s = s.replace(/^[a-z][a-z0-9+.\-]*:\/\//, "");
  // Strip credentials.
  s = s.replace(/^[^@/]+@/, "");
  // Strip path/query/fragment.
  s = s.split(/[/?#]/)[0] ?? "";
  // Strip port.
  s = s.split(":")[0] ?? "";
  // Strip leading www.
  s = s.replace(/^www\./, "");
  // Strip trailing dot.
  s = s.replace(/\.$/, "");
  return s;
}

/** Extract the normalized domain from an email address. */
export function domainFromEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at === -1) return "";
  return normalizeDomain(email.slice(at + 1));
}
