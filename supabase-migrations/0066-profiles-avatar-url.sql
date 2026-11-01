-- Production answers 400 "column profiles.avatar_url does not exist" on every
-- sign-in before getProfile's retry drops the column. supabase-schema.sql
-- already declares it; this brings the live table in line. Safe to re-run.
alter table public.profiles add column if not exists avatar_url text default '';
