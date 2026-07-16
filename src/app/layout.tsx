import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/toast";

export const metadata: Metadata = {
  title: "Launchbench | Founder ops for distribution",
  description: "Launchbench helps small businesses find qualified leads, prepare outreach, create product-specific social content, and keep the next action organized.",
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
