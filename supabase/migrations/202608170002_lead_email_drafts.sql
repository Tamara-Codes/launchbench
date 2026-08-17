alter table public.sales_leads
  add column draft_subject text not null default '',
  add column draft_body text not null default '',
  add column draft_generated_at timestamptz;
