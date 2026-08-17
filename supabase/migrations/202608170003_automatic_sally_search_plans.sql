alter table public.projects
  add column if not exists lead_search_plan jsonb not null
    default '{"textQueries":[],"countries":[]}'::jsonb,
  add column if not exists lead_search_plan_generated_at timestamptz;

update public.projects
set lead_search_plan = jsonb_build_object(
  'textQueries', to_jsonb(lead_search_terms),
  'countries', '[]'::jsonb
)
where jsonb_array_length(lead_search_plan->'textQueries') = 0
  and cardinality(lead_search_terms) > 0;

alter table public.territories
  add column if not exists google_place_id text not null default '',
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists search_radius_m integer not null default 15000
    check (search_radius_m between 1000 and 50000);
