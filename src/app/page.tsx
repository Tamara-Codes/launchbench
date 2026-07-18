import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing-page";
import { siteDescription } from "@/lib/site";

export const metadata: Metadata = {
  description: siteDescription,
  alternates: { canonical: "/" },
};

/** Public landing page. The tenant-aware workspace lives at /app. */
export default function HomePage() {
  return <MarketingPage />;
}
