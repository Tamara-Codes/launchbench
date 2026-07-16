import "server-only";
import { Firecrawl } from "firecrawl";
import { getEnv, hasKey } from "@/env";
import { safeErrorMessage } from "@/lib/redact";
import { validatePublicUrl } from "@/lib/ssrf";

export interface SearchHit {
  url: string;
  title: string;
  description: string;
  position: number;
}

export interface ScrapeDoc {
  url: string;
  markdown: string;
  title: string;
  httpStatus?: number;
}

async function backoff<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = safeErrorMessage(err).toLowerCase();
      // Only retry transient conditions; never retry auth/validation errors.
      const transient =
        msg.includes("rate") ||
        msg.includes("timeout") ||
        msg.includes("429") ||
        msg.includes("502") ||
        msg.includes("503") ||
        msg.includes("network");
      if (!transient || i === tries - 1) break;
      await new Promise((r) => setTimeout(r, 500 * 2 ** i));
    }
  }
  throw lastErr;
}

/** Adapter around the Firecrawl SDK. Search returns lightweight hits (no full
 * scrape); scrape fetches a single validated public URL as markdown. */
export class FirecrawlProvider {
  private client: Firecrawl | null = null;

  isConfigured(): boolean {
    return hasKey("FIRECRAWL_API_KEY");
  }

  private getClient(): Firecrawl {
    if (!this.isConfigured()) throw new Error("FIRECRAWL_API_KEY is not configured.");
    if (!this.client) {
      this.client = new Firecrawl({ apiKey: getEnv().FIRECRAWL_API_KEY });
    }
    return this.client;
  }

  async search(query: string, limit = 10): Promise<SearchHit[]> {
    const client = this.getClient();
    const safeLimit = Math.max(1, Math.min(limit, 10));
    try {
      const res: any = await backoff(() =>
        client.search(query, { limit: safeLimit, sources: ["web"] }),
      );
      const web: any[] = res?.web ?? res?.data?.web ?? res?.data ?? [];
      return (Array.isArray(web) ? web : [])
        .map((r, i) => ({
          url: String(r.url ?? r.link ?? ""),
          title: String(r.title ?? ""),
          description: String(r.description ?? r.snippet ?? ""),
          position: Number(r.position ?? i + 1),
        }))
        .filter((h) => h.url);
    } catch (err) {
      throw new Error(`Firecrawl search failed: ${safeErrorMessage(err)}`);
    }
  }

  async scrape(url: string): Promise<ScrapeDoc> {
    const check = validatePublicUrl(url);
    if (!check.ok) throw new Error(`Refusing to scrape unsafe URL (${check.reason}).`);
    const client = this.getClient();
    try {
      const res: any = await backoff(() =>
        client.scrape(url, { formats: ["markdown"], onlyMainContent: true }),
      );
      const doc = res?.data ?? res ?? {};
      return {
        url,
        markdown: String(doc.markdown ?? ""),
        title: String(doc.metadata?.title ?? doc.title ?? ""),
        httpStatus: doc.metadata?.statusCode ?? doc.statusCode,
      };
    } catch (err) {
      throw new Error(`Firecrawl scrape failed: ${safeErrorMessage(err)}`);
    }
  }
}

export const firecrawl = new FirecrawlProvider();
