create table public.workspace_media_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  product_id uuid not null,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  byte_size integer not null check (byte_size > 0 and byte_size <= 10485760),
  tags jsonb not null default '[]'::jsonb,
  notes text not null default '',
  preferred_reference boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (product_id, workspace_id) references public.products(id, workspace_id) on delete cascade
);
create index workspace_media_assets_product_idx on public.workspace_media_assets(workspace_id, product_id, created_at desc);
alter table public.workspace_media_assets enable row level security;
grant select on public.workspace_media_assets to authenticated;
create policy workspace_media_assets_member_select on public.workspace_media_assets for select to authenticated using (public.is_workspace_member(workspace_id));
