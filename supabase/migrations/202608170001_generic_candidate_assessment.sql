alter table public.sales_leads
  rename column accommodation_type to business_type;

alter table public.territories
  alter column qualification_settings
  set default '{"requirePublicEmail":true,"requireWithinTerritory":true,"requireWebsite":true,"minConfidence":0.5}'::jsonb;

update public.territories
set qualification_settings = qualification_settings
  - 'requireIndependent'
  - 'rejectExistingDigitalGuide';
