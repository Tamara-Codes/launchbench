-- Operator-specific seed for durable business facts. NOT a migration: these are
-- Tamara's own company details, not schema a new tenant should ever receive.
--
-- ops_facts is the cockpit's durable memory: the agent loads this table whole
-- into its prompt every turn, so anything here is something it simply knows
-- rather than something she has to restate. Facts that belong in a seed are the
-- ones that would have to be re-entered if the database were rebuilt.
--
-- Safe to re-run: guarded by the unique (workspace_id, slug) constraint, and
-- existing rows win, because the agent is allowed to refine a fact's wording
-- through write_fact and a re-run must not undo that.
--
-- Targets the workspace's oldest row, matching 202607290001_ops_cockpit_projects.sql.

insert into public.ops_facts (workspace_id, project_id, slug, kind, source, body)
select workspace.id, null, seed.* from (
  select id from public.workspaces order by created_at limit 1
) as workspace, (values
  (
    'obrt-nos-astra',
    'context',
    'user',
    'Tamara opened her obrt (Croatian sole proprietorship) "Nos Astra" on 22 July 2026. '
    || 'That is the business registration date, so it is the start of every tax and reporting '
    || 'period for the business. It is company-level: tax, contributions and admin obligations '
    || 'carry a null project_id and belong to Company, never to one of her projects. '
    || 'The Launchbench workspace slug nos-astra is named after this obrt.'
  ),
  (
    'tamara-identity',
    'person',
    'user',
    'Full name Tamara Martinović. Lives on the island of Krk, Croatia. '
    || 'Contact email codewithtamara@gmail.com.'
  ),
  (
    'algorise-employer',
    'context',
    'user',
    'Algorise is the company Tamara works for as an AI engineer, 9-5, fully remote. '
    || 'It is her employer, separate from her own obrt Nos Astra and from Launchbench and its projects.'
  ),
  (
    'x-posting-schedule',
    'preference',
    'user',
    'Tamara now posts on X throughout the day; posting during EU daytime works fine for her. '
    || 'This replaces an earlier, now-outdated rule that restricted posting to an evening-only window.'
  )
) as seed (slug, kind, source, body)
on conflict (workspace_id, slug) do nothing;

-- Check the result.
select slug, kind, source, updated_at
from public.ops_facts
where workspace_id = (select id from public.workspaces order by created_at limit 1)
order by kind, slug;
