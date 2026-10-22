-- supabase-schema.sql declares employer_requirements.last_matched_at, but
-- as a column with no numbered migration this repo's production database
-- never actually ran it — confirmed live via a 42703 "column does not
-- exist" error from PostgREST. The nightly rematch cron
-- (cron-rematch-requirements.ts) orders by this column, so every run has
-- been silently failing against production since it shipped. Run this file
-- directly in the Supabase SQL editor to close the drift.
alter table employer_requirements add column if not exists last_matched_at timestamptz;
