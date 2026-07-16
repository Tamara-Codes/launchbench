-- Tenant-safe persistence for the Sales Agent. Search evidence and duplicate
-- keys are isolated by workspace; no cross-customer lead memory is shared.

alter table public.territories
  add column qualification_settings jsonb not null default '{"requirePublicEmail":true,"requireWithinTerritory":true,"requireWebsite":true,"requireIndependent":false,"minConfidence":0.5,"rejectExistingDigitalGuide":false}'::jsonb,
  add column notes text not null default '';

alter table public.territories
  add constraint territories_id_workspace_key unique (id, workspace_id);

create table public.sales_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  product_id uuid not null,
  territory_id uuid not null,
  job_id uuid unique references public.agent_jobs(id) on delete set null,
  status public.job_status not null default 'queued',
  stage text not null default 'queued',
  config jsonb not null default '{}'::jsonb,
  stats jsonb not null default '{}'::jsonb,
  current_candidate text not null default '',
  error text not null default '',
  exhaustion_signal text not null default '',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (product_id, workspace_id) references public.products(id, workspace_id) on delete cascade,
  foreign key (territory_id, workspace_id) references public.territories(id, workspace_id) on delete cascade
);
create index sales_runs_workspace_created_idx on public.sales_runs(workspace_id, created_at desc);
create index sales_runs_territory_idx on public.sales_runs(territory_id, created_at desc);

create table public.sales_search_queries (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  territory_id uuid not null references public.territories(id) on delete cascade,
  run_id uuid references public.sales_runs(id) on delete set null,
  raw_query text not null,
  normalized_query text not null,
  result_count integer not null default 0,
  new_result_count integer not null default 0,
  exhausted boolean not null default false,
  created_at timestamptz not null default now(),
  unique (workspace_id, territory_id, normalized_query)
);
create index sales_search_queries_run_idx on public.sales_search_queries(run_id);

create table public.sales_candidates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  territory_id uuid not null references public.territories(id) on delete cascade,
  run_id uuid not null references public.sales_runs(id) on delete cascade,
  url text not null,
  url_hash text not null,
  domain text not null default '',
  title text not null default '',
  snippet text not null default '',
  query text not null default '',
  rank integer not null default 0,
  outcome text not null default 'discovered' check (outcome in ('discovered', 'rejected_pre_scrape', 'duplicate', 'rejected', 'manual_review', 'qualified', 'error')),
  rejection_reason text not null default '',
  lead_id uuid,
  created_at timestamptz not null default now(),
  unique (workspace_id, url_hash)
);
create index sales_candidates_run_idx on public.sales_candidates(run_id, outcome);
create index sales_candidates_domain_idx on public.sales_candidates(workspace_id, domain);

create table public.sales_scraped_pages (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  candidate_id uuid not null references public.sales_candidates(id) on delete cascade,
  url text not null,
  url_hash text not null,
  domain text not null default '',
  page_type text not null default 'landing',
  title text not null default '',
  markdown text not null default '',
  http_status integer,
  created_at timestamptz not null default now(),
  unique (candidate_id, url_hash)
);

create table public.sales_leads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  product_id uuid not null,
  territory_id uuid not null references public.territories(id) on delete cascade,
  run_id uuid references public.sales_runs(id) on delete set null,
  business_name text not null,
  accommodation_type text not null default '',
  town text not null default '',
  settlement text not null default '',
  website text not null default '',
  normalized_domain text not null default '',
  email text not null default '',
  normalized_email text not null default '',
  phone text not null default '',
  normalized_phone text not null default '',
  normalized_name text not null default '',
  contact_page_url text not null default '',
  status text not null default 'awaiting_review' check (status in ('awaiting_review', 'approved', 'rejected', 'contacted', 'replied', 'opted_out')),
  lead_score integer not null default 0 check (lead_score between 0 and 100),
  confidence numeric not null default 0 check (confidence between 0 and 1),
  facts jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (product_id, workspace_id) references public.products(id, workspace_id) on delete cascade
);
create index sales_leads_workspace_status_idx on public.sales_leads(workspace_id, status, created_at desc);
create index sales_leads_territory_idx on public.sales_leads(territory_id, created_at desc);
create index sales_leads_email_idx on public.sales_leads(workspace_id, normalized_email) where normalized_email <> '';
create index sales_leads_domain_idx on public.sales_leads(workspace_id, normalized_domain) where normalized_domain <> '';

alter table public.sales_candidates
  add constraint sales_candidates_lead_fk foreign key (lead_id) references public.sales_leads(id) on delete set null;

create table public.sales_lead_sources (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lead_id uuid not null references public.sales_leads(id) on delete cascade,
  url text not null,
  url_hash text not null,
  field text not null,
  snippet text not null default '',
  created_at timestamptz not null default now()
);
create index sales_lead_sources_lead_idx on public.sales_lead_sources(lead_id);

create table public.sales_lead_status_history (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lead_id uuid not null references public.sales_leads(id) on delete cascade,
  from_status text not null default '',
  to_status text not null,
  reason text not null default '',
  created_at timestamptz not null default now()
);

create trigger sales_runs_set_updated_at before update on public.sales_runs for each row execute function public.set_updated_at();
create trigger sales_leads_set_updated_at before update on public.sales_leads for each row execute function public.set_updated_at();

alter table public.sales_runs enable row level security;
alter table public.sales_search_queries enable row level security;
alter table public.sales_candidates enable row level security;
alter table public.sales_scraped_pages enable row level security;
alter table public.sales_leads enable row level security;
alter table public.sales_lead_sources enable row level security;
alter table public.sales_lead_status_history enable row level security;

grant select on public.sales_runs, public.sales_search_queries, public.sales_candidates, public.sales_scraped_pages, public.sales_leads, public.sales_lead_sources, public.sales_lead_status_history to authenticated;

create policy sales_runs_member_select on public.sales_runs for select to authenticated using (public.is_workspace_member(workspace_id));
create policy sales_search_queries_member_select on public.sales_search_queries for select to authenticated using (public.is_workspace_member(workspace_id));
create policy sales_candidates_member_select on public.sales_candidates for select to authenticated using (public.is_workspace_member(workspace_id));
create policy sales_scraped_pages_member_select on public.sales_scraped_pages for select to authenticated using (public.is_workspace_member(workspace_id));
create policy sales_leads_member_select on public.sales_leads for select to authenticated using (public.is_workspace_member(workspace_id));
create policy sales_lead_sources_member_select on public.sales_lead_sources for select to authenticated using (public.is_workspace_member(workspace_id));
create policy sales_lead_status_history_member_select on public.sales_lead_status_history for select to authenticated using (public.is_workspace_member(workspace_id));
