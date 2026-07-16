# Production operations runbook

## Before every production deployment

1. In Vercel, set production-only values for `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
   `GEMINI_API_KEY`, `FIRECRAWL_API_KEY`, `NEXT_PUBLIC_APP_URL`, and
   `WORKFLOWS_ENABLED=true`.
2. Never add a server key using a `NEXT_PUBLIC_` name.
3. Run `npm run verify:deployment` with `VERCEL_ENV=production` in the build
   environment. It fails closed for missing Supabase, Gemini, HTTPS app URL,
   or durable-workflow configuration.
4. Apply Supabase migrations `001` through `006` in order to development,
   execute a two-user isolation test, then apply the same migrations to
   production.
5. Confirm the Vercel deployment exposes the security headers configured in
   `next.config.ts` and that `/app` redirects unauthenticated requests to
   `/login`.

## Logs and alerts

Vercel captures JSON logs emitted by `src/lib/observability.ts`. Filter by
`event`, `workspaceId`, `jobId`, or `jobKind`; log messages are redacted.

For an external incident destination, set `OPERATIONAL_ALERTS_ENABLED=true`
and `ALERT_WEBHOOK_URL` to a private webhook. Alerts contain only redacted
error text and operational identifiers. Test it by running a deliberately
invalid job in development; do not paste webhook URLs into source code.

## Backup and restore

Supabase database backups/PITR are the primary database recovery mechanism.
Enable the plan-level backup/PITR option before accepting customers. Storage is
separate from Postgres: retain a periodic export of the private
`workspace-media` bucket as well.

Restore procedure:

1. Put the application into maintenance mode by disabling workflow dispatch.
2. Restore database and storage into a new Supabase project first.
3. Run the two-user isolation test and verify a sample workspace's media paths.
4. Point a staging Vercel deployment at the restored project and test login,
   products, jobs, and generated content.
5. Only then switch production traffic. Record the incident and rotate any
   keys suspected to have been exposed.

## Account and data deletion

Deletion is a privileged, audited operation—not a browser-side cascade.

1. Verify the requester owns the workspace and wait through the product's
   deletion grace period.
2. Export the workspace data if requested.
3. A trusted worker deletes all `workspace-media/<workspace-id>/` storage
   objects, then deletes the workspace row. Foreign-key cascades delete its
   tenant-owned database records.
4. Record only the workspace ID, request timestamp, actor, and completion
   timestamp in an internal audit system; do not retain customer content.
5. Confirm that the workspace no longer appears to the user and that bucket
   prefix listing is empty. Backups expire according to the configured backup
   retention policy rather than being surgically edited.

## Release gates

- `npm run typecheck` and `npm test` pass.
- A new user can sign in with Google and GitHub, create a workspace, and see
  only their own records.
- A second user cannot read, change, upload to, queue work for, or cancel work
  in the first user's workspace through the UI or direct Supabase API.
- A cancelled Sales or Content job does not produce additional work after the
  current candidate/variation boundary.
- Recovered jobs stop at their configured maximum attempt count rather than
  retrying indefinitely.
