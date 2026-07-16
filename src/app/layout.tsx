import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { Toaster } from "@/components/toast";
import { listProducts } from "@/server/repo";
import { getSelectedProduct } from "@/server/product-context";
import { hasSupabaseConfig } from "@/env";

export const metadata: Metadata = {
  title: "Launchbench | Founder ops for distribution",
  description: "Launchbench helps small businesses find qualified leads, prepare outreach, create product-specific social content, and keep the next action organized.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  if (hasSupabaseConfig() || process.env.MARKETING_PREVIEW === "true") {
    return <html lang="en"><body><div className="min-h-[100dvh]">{children}</div><Toaster /></body></html>;
  }
  const [products, selectedProduct] = await Promise.all([listProducts(), getSelectedProduct()]);
  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen flex-col md:flex-row">
          <Sidebar
            products={products.map((product) => ({ id: product.id, name: product.name, active: product.active }))}
            selectedProductId={selectedProduct?.id ?? null}
          />
          <main className="min-w-0 flex-1">
            <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
          </main>
        </div>
        <Toaster />
      </body>
    </html>
  );
}
