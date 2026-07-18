# Supabase setup for LaunchBench

This folder contains the production multi-tenant schema. Do not apply it to the
Supabase migrations for the Launchbench tenant-aware application. Apply them in a new Supabase project.

## 1. Create environments

Create two Supabase projects: one for development and one for production. Keep
their credentials separate. Never use a production service-role key locally.

## 2. Add application environment variables

Copy these values from each project's Connect panel into the matching local or
Vercel environment:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
```

The service-role key is server-only. It must never begin with `NEXT_PUBLIC_` and
must never be placed in client-side code.

## 3. Apply the migrations in order

In the Supabase SQL Editor for the development project, run these files in
order. Do not skip a file:

1. `migrations/202607160001_multitenant_foundation.sql`
2. `migrations/202607160002_durable_agent_jobs.sql`
3. `migrations/202607160003_tenant_sales_agent.sql`
4. `migrations/202607160004_secure_job_enqueue.sql`
5. `migrations/202607160005_privilege_hardening.sql`
6. `migrations/202607160006_tenant_content_agent.sql`
7. `migrations/202607160007_bounded_job_retries.sql`
8. `migrations/202607160008_tenant_media_assets.sql`
9. `migrations/202607160009_tenant_gmail_connection.sql`
10. `migrations/202607160010_workspace_agent_settings.sql`
11. `migrations/202607160011_rename_nos_astra_workspace.sql`

Together they create workspaces, product-scoped templates, integration
connections, durable job records, Sales Agent data, private media storage, and
Row Level Security policies.

## 4. Configure OAuth providers

Enable **Google** and **GitHub** under Authentication → Sign In / Providers.
For each provider, create an OAuth application using the callback URL that
Supabase displays (it has the form
`https://<project-ref>.supabase.co/auth/v1/callback`).

In Authentication → URL Configuration, add these redirect URLs:

```text
http://localhost:3000/auth/callback
https://<your-vercel-domain>/auth/callback
```

Use the production custom domain too once it exists. Do not request Gmail scopes
for app sign-in. Gmail sending authorization is a separate Composio connection
that will be attached to a workspace.

## 5. Verify tenant isolation before enabling agents

Create two test users, each with a workspace. Confirm that neither user can
read, modify, or upload files into the other workspace. This is a release gate,
not an optional manual check.
