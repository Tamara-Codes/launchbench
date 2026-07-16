import { normalizeUrl } from "@/lib/normalize/url";
import { isScrapableDomain } from "@/lib/ssrf";

const CONTACT_HINTS = ["contact", "kontakt", "about", "o-nama", "o_nama", "impressum"];
const ACCOMMODATION_HINTS = [
  "apartman",
  "apartment",
  "smjestaj",
  "accommodation",
  "rooms",
  "sobe",
  "booking",
  "rezervacij",
  "unit",
];

export type PageType = "landing" | "contact" | "about" | "accommodation" | "booking";

export function classifyPage(url: string): PageType {
  const u = url.toLowerCase();
  if (u.includes("book") || u.includes("rezervacij")) return "booking";
  if (CONTACT_HINTS.some((h) => u.includes(h))) {
    return u.includes("about") || u.includes("o-nama") ? "about" : "contact";
  }
  if (ACCOMMODATION_HINTS.some((h) => u.includes(h))) return "accommodation";
  return "landing";
}

/** Extract absolute links from scraped markdown, restricted to the same host
 * and to scrapable (non-social/marketplace) domains. Prioritizes contact/about
 * pages so we scrape the minimum useful set. */
export function pickEnrichmentUrls(
  landingUrl: string,
  markdown: string,
  maxPages: number,
): string[] {
  let base: URL;
  try {
    base = new URL(landingUrl);
  } catch {
    return [];
  }
  const host = base.hostname.replace(/^www\./, "");
  const linkRe = /\]\((https?:\/\/[^)\s]+)\)|href="(https?:\/\/[^"]+)"/gi;
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(markdown)) !== null) {
    const raw = m[1] ?? m[2];
    if (!raw) continue;
    try {
      const u = new URL(raw);
      if (u.hostname.replace(/^www\./, "") !== host) continue;
      if (!isScrapableDomain(raw)) continue;
      found.add(normalizeUrl(raw));
    } catch {
      /* ignore */
    }
  }
  const landingNorm = normalizeUrl(landingUrl);
  const candidates = Array.from(found).filter((u) => u !== landingNorm);

  // Rank: contact/about first, then accommodation/booking.
  const scored = candidates
    .map((u) => {
      const t = classifyPage(u);
      const rank = t === "contact" || t === "about" ? 0 : t === "accommodation" || t === "booking" ? 1 : 2;
      return { u, rank };
    })
    .sort((a, b) => a.rank - b.rank);

  // maxPages includes the landing page already scraped, so return maxPages-1.
  return scored.slice(0, Math.max(0, maxPages - 1)).map((s) => s.u);
}
