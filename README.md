# Launchbench — Founder ops for distribution

A local, single-user sales-assistant that finds qualified accommodation leads in a
chosen town, remembers everything it has ever done, and drafts/sends approved
outreach through Gmail. It runs entirely on your computer against a local SQLite
database. **No login, no accounts, no cloud state.**

The first agent — **Sales Agent** — finds up to N new, qualified,
contactable accommodation businesses in a selected territory (e.g. *Malinska*),
with source evidence for every fact.

> This repo also contains a separate **Content Agent** (Instagram content
> generation). This README covers installation + the sales-assistant workflow;
> the two agents share the same database and settings.

---

## 1. Required software

- **Node.js 22 LTS** (or newer LTS). Check with `node --version`.
- **npm 10+** (bundled with Node 20).
- A C toolchain is only needed if `better-sqlite3` has to compile from source;
  prebuilt binaries are used on most platforms.

## 2. Recommended Node.js version

Node **22.x LTS**. This is required by the current Supabase and Firecrawl SDKs.

## 3. Installation

```bash
npm install
```

## 4. Creating `.env.local`

Copy the example and fill in the values you have. The app boots without provider
keys — each feature tells you what it needs.

```bash
cp .env.example .env.local
```

```env
DATABASE_URL=./data/sales-agent.db

GEMINI_API_KEY=            # https://aistudio.google.com/apikey
GEMINI_MODEL=gemini-3.5-flash


FIRECRAWL_API_KEY=         # https://www.firecrawl.dev/app/api-keys

COMPOSIO_API_KEY=          # https://app.composio.dev
COMPOSIO_AUTH_CONFIG_ID=   # Gmail auth-config id from the Composio dashboard

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

All secret keys are **server-only** and are never exposed to the browser.

## 5. Initializing SQLite

The database file is created automatically at `data/sales-agent.db` on first
migrate. WAL journal mode, foreign-key enforcement and a busy timeout are enabled
for you.

## 6. Running Drizzle migrations

```bash
npm run db:migrate
```

If you change `src/db/schema.ts`, regenerate SQL first:

```bash
npm run db:generate    # writes ./drizzle/*.sql
npm run db:migrate
```

## 7. Running the seed script

```bash
npm run db:seed
```

Seeds the lead-finder agent + default prompts, the *Digital Guest Welcome Book*
product, six email templates (HR/EN × initial/first/final follow-up), default
follow-up rules, qualification + app settings, and a default *Malinska* territory.
The seed is idempotent — existing rows are left untouched.

## 8. Starting the application

```bash
npm run dev
```

## 9. Opening localhost

Open **http://localhost:3000**. The dev server binds to localhost only.

## 10. Gemini API configuration

Set `GEMINI_API_KEY` and (optionally) `GEMINI_MODEL` in the server environment. Default is
`gemini-3.5-flash` — the stable, current Flash model. If it is unavailable in
your account, set `GEMINI_MODEL` to another supported Gemini model.
Gemini is used only for structured analysis of *promising* candidates. Provider
credentials are deployment configuration: they are never entered by app users
and are not stored in the database.

## 11. Firecrawl configuration

Set `FIRECRAWL_API_KEY`. Firecrawl is used for web **search** (discovery) and for
**scraping** individual public pages to markdown. Social networks, marketplaces
(Booking/Airbnb), Google Maps and auth-walled pages are never scraped.

## 12. Composio Gmail configuration

1. Create a Composio account and a **Gmail auth config** (Auth Configs → Gmail,
   OAuth2) in the Composio dashboard.
2. Put `COMPOSIO_API_KEY` and the Gmail **auth-config id** into `.env.local`.
3. In the app: **Settings → Gmail → Connect Gmail**. A hosted authorization page
   opens in a new tab; authorize, then click **Refresh status**. Status becomes
   `active` when connected.

Only Composio connection identifiers are stored locally — never raw OAuth tokens.

## 13. How lead search works

1. **Load memory** — previous queries (incl. exhausted), processed URLs, known
   domains/emails/phones/names, accepted + rejected + duplicate + contacted
   records for the territory. No LLM.
2. **Plan** — deterministic Croatian + English query templates for the town,
   skipping anything already run/exhausted. Capped by *max queries*.
3. **Discover** — Firecrawl search returns lightweight hits (title/URL/snippet).
   Obvious irrelevancies and known/duplicate domains are rejected *before*
   scraping.
4. **Enrich** — scrape the landing page + a minimal set of contact/about pages
   (capped by *max pages per candidate*). Deterministic extraction of
   emails/phones/links first.
5. **Analyze** — Gemini structured output (strict schema, validated with Zod).
6. **Deduplicate** — canonical keys (email → domain → phone → name+locality),
   fuzzy matches flagged for review only, never auto-merged.
7. **Qualify** — mandatory checks in code (the model only advises). Stops at the
   target. Fewer than the target may be returned — the bar is never lowered.
8. **Save** — leads + source evidence + status history in a transaction;
   candidates, processed URLs, queries and run stats persisted immediately.

The town is a **hard boundary**: ambiguous locations become *manual review* and
do **not** count toward the target. The agent never silently expands to another
town.

## 14. How duplicate prevention works

Every candidate is canonicalized (lowercased, diacritics folded for comparison,
`www`/tracking params/trailing slashes stripped, phone → E.164, business-name
suffixes/noise removed). Exact matches on email/domain/phone or name+locality are
**confirmed** duplicates and skipped (the new source URL is still attached to the
existing lead). Strong-but-inexact name matches are stored as **uncertain** for
manual review. Rejected candidates stay stored so they are never rediscovered.

## 15. How to edit the agent prompt

**Agents → Sales Agent.** Edit the system prompt, task template,
model, temperature and max tokens. **Preview** renders the task template with
sample variables. Executable code is never allowed in agent settings; inputs are
Zod-validated.

## 16. How to restore a prompt version

Every save creates a numbered prompt version. Open **Version history** on the
agent page and click **Restore** on any version (this itself creates a new
version). **Restore default** re-applies the seeded prompt.

## 17. How Gmail drafts and sending work

From a lead or the **Email Queue**: generate a draft, edit it, **Approve**, then
**Create Gmail draft** or **Send now**. Sending requires an active Gmail
connection and explicit confirmation. Bulk approve/send show the exact recipient
list before proceeding. Sends are **idempotent** (a unique per-draft send key
prevents duplicates from double-clicks/refreshes); uncertain failures are never
auto-retried.

## 18. How replies and follow-ups work

Nothing happens while the app is closed. Use **Check Gmail for Replies** — it
searches Gmail for messages from contacted leads, marks them *replied* (or
*opted out* if an opt-out phrase is detected), records the thread, and **cancels
pending follow-ups**. Follow-ups are scheduled automatically after an initial
send (default +4 days, then +7). **Prepare Due Follow-ups** marks due ones; you
then generate, approve and send them like any other email.

## 19. How to back up the database

**Settings → Data & backup → Create backup.** Uses SQLite's safe online backup
(WAL-aware) and writes a timestamped file to `backups/` — previous backups are
never overwritten.

## 20. How to restore a backup

1. Stop the dev server.
2. Copy your chosen `backups/sales-agent-YYYY-MM-DD-HHMMSS.db` over
   `data/sales-agent.db` (delete any stale `data/sales-agent.db-wal` /
   `-shm` first).
3. Start the server again.

## 21. How to export leads

**Settings → Data & backup:** *Leads CSV*, *Leads JSON*, or *All data JSON*.
(Direct URLs: `/api/export?type=leads-csv|leads-json|all-json`.)

## 22. How to inspect SQLite manually

```bash
npm run db:studio         # Drizzle Studio (browser UI)
# or:
sqlite3 data/sales-agent.db ".tables"
sqlite3 data/sales-agent.db "SELECT business_name, email, status FROM leads;"
```

## 23. How to add another agent later

1. Add its table config to the DB (an `agents` row) via a seed/migration.
2. Implement the `AgentDefinition<TInput, TOutput>` interface
   (`src/agents/types.ts`) with `slug`, `validateInput` (Zod) and `execute`.
3. Register it in `src/agents/registry.ts`.
4. Add a page/action to trigger it. The run engine (`src/server/run-engine.ts`)
   already handles state, progress, cancellation and resume generically.

## 24. Security notes

- Provider keys are server-only (`src/env.ts`, guarded by `server-only`) and
  never reach the browser.
- All scraped webpage text is treated as **untrusted evidence** — kept separate
  from system instructions, and the system prompt forbids following embedded
  instructions or revealing prompts/keys.
- URL validation + SSRF protection block private/loopback/link-local/metadata
  ranges and non-http(s) protocols before any scrape.
- Zod validates inputs; provider errors are redacted before logging.
- Sends require explicit approval + confirmation and are idempotent.

## 25. Current MVP limitations

- Work happens **only while the app is running** — no background jobs, cron or
  queues. Searches, reply checks, follow-up prep and sends are all manual.
- Runs execute in the local Next.js server process. On a hard restart mid-run,
  the run is detected as interrupted and can be **resumed** (progress is stored
  continuously).
- Gemini query *suggestions* beyond the deterministic templates are intentionally
  minimal to control cost.
- Reply detection is heuristic (by sender + opt-out phrases); review important
  threads in Gmail.

## 26. Troubleshooting database locks

SQLite is single-writer. If you see `database is locked`: ensure only one app
instance and one Studio session are open; the busy timeout (5s) usually resolves
contention. Stale WAL files after a crash are safe to remove **while the server
is stopped** (`data/sales-agent.db-wal`, `-shm`).

## 27. Troubleshooting Gmail OAuth

- `initiated` but never `active`: finish authorization in the opened tab, then
  **Refresh status**.
- Missing config error: set `COMPOSIO_API_KEY` **and** `COMPOSIO_AUTH_CONFIG_ID`,
  then restart the dev server (env is read at startup).
- Expired connection: **Reconnect** in Settings → Gmail.

## 28. Troubleshooting provider rate limits

Firecrawl calls use bounded exponential backoff for transient errors (429/5xx)
only. If you hit limits, lower *max queries* / *max candidates* / *max pages per
candidate* on Find Leads. Gemini is only called for promising candidates; the run
stops immediately once the target is met.

## 29. Updating database migrations

```bash
# 1. edit src/db/schema.ts
npm run db:generate     # creates a new ./drizzle migration
npm run db:migrate      # applies it
```

Commit both the schema change and the generated SQL.

## 30. Optional future deployment considerations

This is designed as a **local** tool and binds to localhost. If you ever host it,
add authentication, restrict network exposure, move secrets to a secret manager,
and note that better-sqlite3 needs a writable local filesystem (serverless
platforms are unsuitable).

---

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the app (http://localhost:3000) |
| `npm run build` | Production build |
| `npm run start` | Serve the production build (localhost) |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest (unit + integration) |
| `npm run db:generate` | Generate Drizzle migrations from schema |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Seed default data |
| `npm run db:studio` | Drizzle Studio |

## First-run checklist

```bash
npm install
cp .env.example .env.local     # fill in keys you have
npm run db:migrate
npm run db:seed
npm run dev                     # open http://localhost:3000
```

Then: **Find Leads → pick Malinska → Start Search** (needs Gemini + Firecrawl
keys). Review in **Leads**, generate an email, connect Gmail in **Settings**,
approve and send from the **Email Queue**.
