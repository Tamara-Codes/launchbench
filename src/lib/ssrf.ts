/**
 * URL validation + SSRF protection for anything we hand to a scraper.
 * We only ever allow public http(s) URLs and block private / loopback /
 * link-local / metadata ranges to prevent scraping internal resources.
 */

const BLOCKED_HOST_PATTERNS: RegExp[] = [
  /^localhost$/i,
  /\.local$/i,
  /\.internal$/i,
];

function isPrivateIpv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const parts = m.slice(1).map((n) => Number(n));
  if (parts.some((p) => p === undefined || p < 0 || p > 255)) return true;
  const [a, b] = parts as [number, number, number, number];
  if (a === 10) return true;
  if (a === 127) return true; // loopback
  if (a === 0) return true;
  if (a === 169 && b === 254) return true; // link-local + metadata 169.254.169.254
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast / reserved
  return false;
}

function isPrivateIpv6(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (h === "::1" || h === "::") return true;
  // IPv4-mapped IPv6 literals can otherwise smuggle an IPv4 address. Node
  // normalizes dotted forms into hexadecimal, so reject the entire notation.
  if (h.startsWith("::ffff:")) return true;
  if (h.startsWith("fe80")) return true; // link-local
  if (h.startsWith("fc") || h.startsWith("fd")) return true; // unique local
  return false;
}

export interface UrlCheck {
  ok: boolean;
  reason?: string;
  url?: URL;
}

export function validatePublicUrl(input: string): UrlCheck {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return { ok: false, reason: "invalid-url" };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "protocol-not-allowed" };
  }
  if (url.username || url.password) return { ok: false, reason: "credentials-not-allowed" };

  const host = url.hostname.toLowerCase();
  if (!host) return { ok: false, reason: "empty-host" };

  for (const re of BLOCKED_HOST_PATTERNS) {
    if (re.test(host)) return { ok: false, reason: "blocked-host" };
  }
  if (isPrivateIpv4(host)) return { ok: false, reason: "private-ipv4" };
  if (host.includes(":") || host.startsWith("[")) {
    if (isPrivateIpv6(host)) return { ok: false, reason: "private-ipv6" };
  }

  return { ok: true, url };
}

export function isPublicUrl(input: string): boolean {
  return validatePublicUrl(input).ok;
}

// Hosts we refuse to scrape/automate per spec (social, marketplaces, auth-walled).
const BLOCKED_SCRAPE_DOMAINS = [
  "facebook.com",
  "fb.com",
  "instagram.com",
  "booking.com",
  "airbnb.com",
  "airbnb.co.uk",
  "maps.google.com",
  "google.com/maps",
  "tripadvisor.com",
  "linkedin.com",
  "twitter.com",
  "x.com",
  "youtube.com",
  "tiktok.com",
  "expedia.com",
  "trivago.com",
];

export function isScrapableDomain(input: string): boolean {
  const check = validatePublicUrl(input.startsWith("http") ? input : `https://${input}`);
  if (!check.ok || !check.url) return false;
  const host = check.url.hostname.toLowerCase().replace(/^www\./, "");
  const full = `${host}${check.url.pathname}`.toLowerCase();
  return !BLOCKED_SCRAPE_DOMAINS.some(
    (d) => host === d || host.endsWith(`.${d}`) || full.includes(d),
  );
}
