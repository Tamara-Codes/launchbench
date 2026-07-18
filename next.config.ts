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

// The Workflow SDK generates internal webhook routes. Keep those routes out of
// builds where dispatch is deliberately disabled (the local default), so the
// app can be built and tested without provisioning the Workflow runtime.
// Production enables this flag as part of its deployment configuration.
export default process.env.WORKFLOWS_ENABLED === "true"
  ? withWorkflow(nextConfig)
  : nextConfig;
