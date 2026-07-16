import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ];
  },
  experimental: {
    // Product reference photos regularly exceed Next's 1 MB Server Action
    // default. Keep uploads bounded while allowing normal phone exports.
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  // Native / Node-only SDKs: keep them out of the bundler so they load via
  // Node's require at runtime (avoids optional-dependency resolution warnings
  // such as firecrawl's `undici`, and native-binding issues for better-sqlite3).
  serverExternalPackages: [
    "better-sqlite3",
    "firecrawl",
    "@composio/core",
    "@google/genai",
  ],
};

export default withWorkflow(nextConfig);
