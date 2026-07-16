# Launchbench

**Founder ops for distribution.**

Launchbench is a SaaS workspace that helps product businesses turn distribution
into a repeatable practice. It brings lead discovery, outreach preparation, and
social-content planning into one place—while keeping people in control of every
message and publish decision.

## What it does

- Find and qualify relevant business leads.
- Research prospects and retain useful contact context.
- Prepare outreach campaigns, email drafts, and follow-ups for review.
- Create product-specific social post ideas, captions, images, and content plans.
- Keep products, agent work, media, and activity organized per workspace.

Launchbench is designed as a multi-tenant SaaS product. Workspace data and
authentication are backed by Supabase; external providers support AI generation,
web research, and Gmail connectivity.

## Product principles

- **Human approval first.** Launchbench prepares work; it does not send email or
  publish content without a person’s review.
- **Useful context, not generic output.** Work is grounded in the selected
  product, saved leads, and workspace history.
- **Focused agents.** Each agent has a specific job rather than pretending to be
  an open-ended chatbot.

## Tech stack

- Next.js and React
- TypeScript and Tailwind CSS
- Supabase for authentication and multi-tenant data
- Gemini for AI-assisted generation
- Firecrawl and Google services for discovery and research
- Composio for Gmail connectivity

## Local development

### Prerequisites

- Node.js 22+
- npm
- A Supabase project

### Start the app

```bash
npm install
cp .env.example .env.local
npm run dev
```

Fill in the Supabase values in `.env.local` before using the authenticated SaaS
experience. Add provider credentials as you enable the matching capability:

| Capability | Environment variables |
| --- | --- |
| Authentication and workspace data | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| AI-assisted generation | `GEMINI_API_KEY` |
| Lead discovery and research | `FIRECRAWL_API_KEY`, `GOOGLE_PLACES_API_KEY`, `GOOGLE_CSE_API_KEY`, `GOOGLE_CSE_ID` |
| Gmail connection | `COMPOSIO_API_KEY`, `COMPOSIO_AUTH_CONFIG_ID` |

Apply the SQL migrations in [`supabase/migrations`](supabase/migrations) to your
Supabase project. Never commit `.env.local` or provider credentials.

## Useful commands

```bash
npm run dev          # Start local development
npm run build        # Create a production build
npm run typecheck    # Check TypeScript
npm run test         # Run tests
```

## Status

Launchbench is under active development. The product direction and deployment
configuration will continue to evolve as the SaaS launches.
