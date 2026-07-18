import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/toast";
import { siteDescription, siteName, siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: {
    default: "Launchbench | Founder ops for distribution",
    template: "%s | Launchbench",
  },
  description: siteDescription,
  applicationName: siteName,
  authors: [{ name: "Tamara", url: "https://tamara.rocks" }],
  creator: "Tamara",
  publisher: siteName,
  formatDetection: { email: false, address: false, telephone: false },
  openGraph: {
    type: "website",
    siteName,
    locale: "en_US",
    title: "Launchbench | Founder ops for distribution",
    description: siteDescription,
    images: [{ url: "/images/solo-builder-hero.png", width: 1024, height: 1536, alt: "Founder working on outreach and a content calendar" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Launchbench | Founder ops for distribution",
    description: siteDescription,
    images: ["/images/solo-builder-hero.png"],
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-[100dvh]">{children}</div>
        <Toaster />
      </body>
    </html>
  );
}
