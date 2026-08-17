-- Operator-specific seed for the ops cockpit. NOT a migration: this is Tamara's
-- own project list and personal-brand strategy, not schema a new tenant should
-- ever receive. Run it once, by hand, after 202607290001_ops_cockpit.sql.
--
-- Safe to re-run: every insert is guarded by the existing unique constraints
-- (projects is unique on (workspace_id, name), content_strategies on project_id),
-- so anything already present is left exactly as it is.
--
-- Targets the workspace's oldest row (there is currently exactly one:
-- "LaunchBench", slug nos-astra). Verify with the SELECT at the bottom if a
-- second workspace ever exists.
--
-- Two projects are deliberately absent below because they are already in the
-- database and their existing rows should win: "Mastograd" (the Wonder Pages
-- product, already named for its domain) and "Welcome Book".

with workspace as (
  select id from public.workspaces order by created_at limit 1
)
insert into public.projects (
  workspace_id, name, short_description, target_customer, core_benefit,
  price_text, website_url, preferred_language, active
)
select workspace.id, seed.* from workspace, (values
  (
    'Erin AI',
    'WhatsApp budgeting assistant for Croatia (was LovaDoKrova).',
    'Croatian households who want to track spending without installing or learning an app — they already live in WhatsApp.',
    'Type or say what you spent in Croatian and it is categorised and totalled, with no app to open.',
    '14-day no-card trial, then €3.99/month', '', 'hr', true
  ),
  (
    'Stacklight',
    'Daily digest that watches your AI and dev stack and rates what changed.',
    'Solo developers and small teams running on Vercel, Supabase, Anthropic, OpenAI, GitHub and Stripe, who cannot read every changelog.',
    'One email a day, each change rated red, yellow or green, so breaking news reaches you before your build does.',
    'Starter €5/month (10 tools) · Full Stack €10/month', '', 'en', true
  ),
  (
    'Launchbench',
    'Founder ops for distribution: a lead-finding agent and a content agent.',
    'Solo founders and very small teams who can build a product but stall completely on finding customers and posting consistently.',
    'The distribution work that usually goes undone gets done by two agents that already know your product.',
    'Starter €29 · Growth €59 · Scale €99 per month', '', 'en', true
  ),
  (
    'You''re Absolutely Right',
    'Free browser game: ship one line on a Friday and let your AI assistant help you delete production.',
    'Working developers who have watched an AI assistant confidently make things worse, and will recognise themselves immediately.',
    'A two-minute laugh that developers repost, which is the point — this one exists to grow the audience, not to earn.',
    'Free', 'https://youreabsolutelyright.tamara.rocks', 'en', true
  ),
  (
    'My AI Startup',
    'Cozy learning game that teaches AI-app concepts through play.',
    'Career changers and beginners who want to understand how AI apps actually work but bounce off documentation and tutorials.',
    'You hit the problem in the game first and only then learn its real name, so the concept sticks.',
    'Free', '', 'en', true
  ),
  (
    'KitchenOS',
    'Family meal planner and pantry tracker with live Croatian grocery prices.',
    'Croatian families planning the week''s meals who want to know which shop is actually cheapest for this basket.',
    'Plan the week, then see the real per-kilo prices and where the basket costs least.',
    'Not priced yet', '', 'hr', true
  ),
  (
    'Personal Brand',
    'Tamara herself: the ex-biochemist who became an AI engineer at 37 and ships apps at 40.',
    'Late starters, career changers, and people who assume it is too late for them — plus the developers who stay for the builds.',
    'Proof that the path exists, told as testimony rather than as a flex.',
    'Not for sale', '', 'en', true
  )
) as seed (
  name, short_description, target_customer, core_benefit,
  price_text, website_url, preferred_language, active
)
on conflict (workspace_id, name) do nothing;

-- The personal-brand strategy, carried over from the retired vault's Brand.md.
-- This is the document the content agent was previously missing: until now the
-- pillars existed only in a file nothing but Tamara read.
insert into public.content_strategies (
  workspace_id, project_id, primary_platform, primary_audience, brand_voice,
  core_messages, content_pillars, prohibited_claims, banned_phrases,
  preferred_ctas, hashtag_guidance, advanced_context
)
select
  projects.workspace_id,
  projects.id,
  'x',
  'Late starters and career changers who would never search "AI engineer" but stop for a human story, plus the higher-intent developers who stay for the builds.',
  'Testimony, not flexing. Rigour, reinvention, realness and generosity — a scientist''s honesty about what actually happened, including the failures. Dry humour. Never hustle-bro.',
  jsonb_build_array(
    'The ex-biochemist who became an AI engineer at 37, ships apps between school runs at 40, and hands back the ladder she climbed.',
    'The moat is the intersection nobody else has: PhD scientist, late starter, woman, mother, full-time job, builder, gives it away.',
    'Do not compete on the bros'' axis of MRR, tools and hustle. Compete on rigour, reinvention, realness and generosity.'
  ),
  jsonb_build_array(
    'Reinvention — "it''s not too late." The proven engine: lab at 1am, Python at 33, unpaid internship, real job, building at 40. Testimony, not flexing.',
    'Scientist-builder — how I build. Dev content in my own voice, not tutorial voice: lab-brain versus vibe-coding chaos, bug autopsies as failed experiments. Show the artifact, do not explain it.',
    'Giving back — the free thing, posted as a gift rather than a lecture. The doorway; deep teaching lives in the long-form.',
    'Meta / self-aware (the flare) — the single biggest reach driver, but 1x per week MAXIMUM or the irony curdles into "person who complains about X, on X."'
  ),
  jsonb_build_array('Never flex MRR or revenue numbers.'),
  jsonb_build_array('hustle', 'grind', 'crushing it', '10x developer'),
  jsonb_build_array('play it 👇', 'steal the playbook', 'reply with your stack'),
  'Hashtags are not part of the voice on X. Leave them out unless there is a specific reason.',
  'CADENCE — "flare, not diet", roughly per week: 1 meta/flare, 2 reinvention, 2 scientist-builder, 1-2 giving back. Never three flares in a row.'
  || E'\n\nRHYTHM — one original post per day, always in the 18:00-01:00 CEST window (US and India awake). Never EU daytime, that is dead air. ~15 minutes replying to a few large in-lane accounts; one good reply on a big account beats a hundred thank-yous. No timeline scrolling. One free thing shipped every 1-2 weeks as the anchor other posts point back to.'
  || E'\n\nJUDGING — judge a post at end of day, never two hours in. On a small account judge by impressions, not likes.'
  || E'\n\nWHY A POST TRAVELS — it gets reposted when it has all five: universal truth, self-aware irony, a shared enemy, punchy list-to-turn structure, and is inherently repostable ("that''s SO me"). Her best post (4,768 impressions, 201 reposts) had all five.'
  || E'\n\nNEVER — flex MRR; post dry tutorials expecting reach; post in EU daytime; quit over a two-hour-old post; mistake her best reflective posts for slop; copy someone else''s persona.'
  || E'\n\nTEXTURE (thread through every pillar, not a pillar itself) — the mother plus full-time-job reality: park bench, laptop at the kid''s party, smartwatch-to-code-outside. This is what makes her THAT AI engineer rather than AN AI engineer.'
from public.projects
where projects.name = 'Personal Brand'
  and projects.workspace_id = (select id from public.workspaces order by created_at limit 1)
on conflict (project_id) do nothing;

-- Check the result: nine projects total (seven added here plus the two that
-- already existed), and one strategy attached to Personal Brand.
select p.name, p.preferred_language, p.price_text, (cs.id is not null) as has_strategy
from public.projects p
left join public.content_strategies cs on cs.project_id = p.id
where p.workspace_id = (select id from public.workspaces order by created_at limit 1)
order by p.name;
