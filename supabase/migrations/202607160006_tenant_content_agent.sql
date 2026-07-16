-- Tenant-owned Content Agent records. Only trusted workers write generated
-- content; customers read it through RLS and can later receive dedicated
-- review/edit actions with explicit policies.

create table public.content_strategies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  product_id uuid not null,
  primary_platform text not null default 'instagram',
  primary_audience text not null default '',
  brand_voice text not null default '',
  core_messages jsonb not null default '[]'::jsonb,
  content_pillars jsonb not null default '[]'::jsonb,
  visual_directions jsonb not null default '[]'::jsonb,
  prohibited_claims jsonb not null default '[]'::jsonb,
  banned_phrases jsonb not null default '[]'::jsonb,
  preferred_ctas jsonb not null default '[]'::jsonb,
  hashtag_guidance text not null default '',
  advanced_context text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (product_id, workspace_id) references public.products(id, workspace_id) on delete cascade,
  unique (product_id)
);

create table public.content_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  product_id uuid not null,
  job_id uuid unique references public.agent_jobs(id) on delete set null,
  status public.job_status not null default 'queued',
  mode text not null check (mode in ('caption', 'image', 'full')),
  input jsonb not null default '{}'::jsonb,
  error text not null default '',
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  foreign key (product_id, workspace_id) references public.products(id, workspace_id) on delete cascade
);

create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  product_id uuid not null,
  run_id uuid references public.content_runs(id) on delete set null,
  platform text not null default 'instagram',
  format text not null check (format in ('single_image', 'carousel', 'story')),
  content_type text not null,
  hook text not null default '',
  caption text not null default '',
  cta text not null default '',
  hashtags jsonb not null default '[]'::jsonb,
  image_prompt text not null default '',
  on_image_text text not null default '',
  visual_direction text not null default '',
  carousel_plan jsonb not null default '[]'::jsonb,
  language text not null default 'hr',
  status text not null default 'generated' check (status in ('idea', 'generated', 'approved', 'scheduled', 'posted', 'skipped', 'archived')),
  scheduled_for timestamptz,
  posted_at timestamptz,
  posted_url text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (product_id, workspace_id) references public.products(id, workspace_id) on delete cascade
);

create table public.content_generated_images (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  product_id uuid not null,
  content_item_id uuid not null references public.content_items(id) on delete cascade,
  storage_path text not null,
  prompt text not null default '',
  provider text not null default 'gemini',
  model text not null default '',
  generation_settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (product_id, workspace_id) references public.products(id, workspace_id) on delete cascade,
  unique (content_item_id)
);

create index content_items_workspace_product_idx on public.content_items(workspace_id, product_id, created_at desc);
create index content_items_workspace_status_idx on public.content_items(workspace_id, status, created_at desc);
create index content_runs_workspace_idx on public.content_runs(workspace_id, created_at desc);
create trigger content_strategies_set_updated_at before update on public.content_strategies for each row execute function public.set_updated_at();
create trigger content_items_set_updated_at before update on public.content_items for each row execute function public.set_updated_at();

alter table public.content_strategies enable row level security;
alter table public.content_runs enable row level security;
alter table public.content_items enable row level security;
alter table public.content_generated_images enable row level security;
grant select on public.content_strategies, public.content_runs, public.content_items, public.content_generated_images to authenticated;
create policy content_strategies_member_select on public.content_strategies for select to authenticated using (public.is_workspace_member(workspace_id));
create policy content_runs_member_select on public.content_runs for select to authenticated using (public.is_workspace_member(workspace_id));
create policy content_items_member_select on public.content_items for select to authenticated using (public.is_workspace_member(workspace_id));
create policy content_generated_images_member_select on public.content_generated_images for select to authenticated using (public.is_workspace_member(workspace_id));
