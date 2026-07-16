import { createHash } from "node:crypto";

const TRACKING_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
  "mc_cid",
  "mc_eid",
  "ref",
  "ref_src",
];

/**
 * Canonicalize a URL for dedup/comparison:
 * - lowercase scheme + host, drop default ports
 * - remove `www.`
 * - strip tracking params, sort remaining params
 * - drop fragment
 * - remove trailing slash on the path
 */
export function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    try {
      url = new URL(`https://${trimmed}`);
    } catch {
      return trimmed.toLowerCase();
    }
  }

  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  url.hash = "";

  if (
    (url.protocol === "http:" && url.port === "80") ||
    (url.protocol === "https:" && url.port === "443")
  ) {
    url.port = "";
  }

  const params = url.searchParams;
  for (const p of TRACKING_PARAMS) params.delete(p);
  const entries = Array.from(params.entries()).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  url.search = "";
  for (const [k, v] of entries) url.searchParams.append(k, v);

  // Collapse the pathname's trailing slash ("/a/b/" -> "/a/b", "/" -> "").
  if (url.pathname !== "/" && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }

  let out = url.toString();
  // "https://host/" -> "https://host" and "https://host/?x=1" -> "https://host?x=1"
  out = out.replace(/^(https?:\/\/[^/?#]+)\/(\?|$)/, "$1$2");
  return out;
}

/** Stable hash of the normalized URL — used as a unique key for processed URLs. */
export function urlHash(input: string): string {
  return createHash("sha256").update(normalizeUrl(input)).digest("hex");
}
