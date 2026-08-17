alter table public.projects
  add column if not exists lead_search_terms text[] not null default '{}';
