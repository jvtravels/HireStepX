-- Adds an experience range and an optional due date to employer_requirements,
-- so the Jobs table can show them without fabricating data. Idempotent
-- (add column if not exists) — safe to re-run.
--
-- Run this in the Supabase Dashboard SQL Editor against the production
-- project, same manual-migration pattern as 0008-employer-tables.sql.

alter table employer_requirements add column if not exists experience_min integer;
alter table employer_requirements add column if not exists experience_max integer;
alter table employer_requirements add column if not exists due_date date;
