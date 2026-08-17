-- Sally's "Email direction" panel was one unstructured textarea covering
-- proof points, CTA, and forbidden claims together, with no way to say who
-- is signing the email or in what grammatical gender (Croatian conjugates
-- first-person verbs by the speaker's gender, e.g. "pisala sam" vs "pisao
-- sam"). Split that out into real fields.

alter table public.projects
  add column sender_gender text not null default 'female' check (sender_gender in ('female', 'male')),
  add column sender_signature text not null default '',
  add column never_claims text not null default '';

comment on column public.projects.email_generation_context is 'Proof points and angles Sally should emphasize when assessing a lead and drafting the first email.';
comment on column public.projects.sender_gender is 'Grammatical gender of the person signing outreach emails, for languages that conjugate by speaker gender.';
comment on column public.projects.sender_signature is 'Sign-off appended to drafted emails, used verbatim.';
comment on column public.projects.never_claims is 'Claims the drafted email must never make, one per line.';
