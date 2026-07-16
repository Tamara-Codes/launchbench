alter table public.integration_connections
  add column oauth_state text not null default '';
create unique index integration_connections_oauth_state_idx on public.integration_connections(oauth_state) where oauth_state <> '';
