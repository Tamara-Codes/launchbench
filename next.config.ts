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
  // Node-only SDKs stay outside the bundler to avoid optional-dependency
  // resolution warnings (for example Firecrawl's undici dependency).
  serverExternalPackages: [
    "firecrawl",
    "@composio/core",
    "@google/genai",
    // @vercel/queue dynamically loads Vercel CLI configuration. Bundling it
    // into Workflow's generated webhook removes the module filename it needs.
    "@vercel/queue",
  ],
};

// The Workflow SDK generates the internal webhook routes that dispatch and run
// queued agent jobs. It applies everywhere so queuing a job actually executes
// it — locally and in production alike.
export default withWorkflow(nextConfig);
