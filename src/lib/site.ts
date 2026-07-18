const rawSiteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/** The public origin used by canonical URLs, social cards, and crawl metadata. */
export const siteUrl = new URL(rawSiteUrl);

export const siteName = "Launchbench";
export const siteDescription =
  "Launchbench helps builders find qualified leads, prepare outreach, and create product-specific social content with human approval at every step.";
