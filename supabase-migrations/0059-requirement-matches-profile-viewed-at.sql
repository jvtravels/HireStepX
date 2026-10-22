-- Column was only in supabase-schema.sql and never reached production, which made
-- /api/candidate-hiring-activity 500 for every candidate. Applied to prod as
-- requirement_matches_profile_viewed_at.
alter table requirement_matches add column if not exists profile_viewed_at timestamptz;
