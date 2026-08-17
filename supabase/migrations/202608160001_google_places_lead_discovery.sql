-- Google Places result pages persist across runs, so Sally continues instead
-- of repeatedly taking only the first page of each query.
alter table public.sales_search_queries
  add column if not exists provider text not null default 'firecrawl',
  add column if not exists next_page_token text not null default '',
  add column if not exists pages_fetched integer not null default 0;

alter table public.sales_candidates
  add column if not exists google_place_id text not null default '',
  add column if not exists google_place jsonb not null default '{}'::jsonb;

create unique index if not exists sales_candidates_workspace_territory_google_place_idx
  on public.sales_candidates(workspace_id, territory_id, google_place_id)
  where google_place_id <> '';

create index if not exists sales_search_queries_google_places_cursor_idx
  on public.sales_search_queries(workspace_id, territory_id, provider, exhausted, created_at);
