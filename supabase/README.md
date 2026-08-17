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
12. `migrations/202607180001_update_content_agent_description.sql`
13. `migrations/202607180002_remove_workspace_agent_versions.sql`
14. `migrations/202607180003_add_workspace_agent_avatar_color.sql`
15. `migrations/202607290001_ops_cockpit.sql`
16. `migrations/202607290002_ops_chat_memory.sql`
17. `migrations/202607300003_fix_ops_product_fk.sql`
18. `migrations/202608010001_rename_products_to_projects.sql`

Together they create workspaces, project-scoped templates, integration
connections, durable job records, Sales Agent data, private media storage, the
ops cockpit's tasks and calendar, the ops agent's memory, and Row Level
Security policies.

### Note: deleting a project with cockpit rows attached

`ops_events` and `ops_tasks` originally declared `foreign key (product_id,
workspace_id) references products(id, workspace_id) on delete set null`. A bare
`set null` nulls *every* referencing column, and `workspace_id` is `not null`, so
deleting a project that still had events or tasks attached failed with a not-null
violation rather than detaching them.

`202607300003_fix_ops_product_fk.sql` repairs both by naming the column that may
be nulled — `on delete set null (product_id)`, which needs Postgres 15 or newer.
Any future table referencing `products` through the composite key must name the
column too. (`202608010001_rename_products_to_projects.sql` later renames the
table to `projects` and every `product_id` column to `project_id` — this note's
column names are historical, describing the bug at the time it was fixed.)

`202608010001_rename_products_to_projects.sql` consolidates "product" and
"project" — used interchangeably since the foundation migration — into a single
term: project. It renames the `products` table to `projects`, every `product_id`
column to `project_id`, and updates `request_agent_job()`'s parameter to match.

## 3a. Seed the operator's own data (optional, not schema)

`seeds/` holds one-off data scripts that are deliberately **not** migrations,
because they contain one operator's projects rather than schema every tenant
should receive. They are written to be safe to re-run: existing rows always win.

- `seeds/202607290001_ops_cockpit_projects.sql` — the nine projects as `products`
  rows (pre-rename; the table is now `projects`) plus the personal-brand
  `content_strategies` record.
- `seeds/202607300001_ops_facts_business.sql` — durable company facts the agent
  reads every turn, starting with the obrt's registration date.

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
