-- Adds contract/project duration (weeks) and weekly-hours commitment to
-- employer_requirements, shown in the Jobs table's Opportunity-column
-- tooltip (matches the canvas design, which surfaces "duration · hours"
-- as extra detail behind an info icon). Both nullable — existing
-- postings have no value until an employer edits them to set one.
-- Idempotent (add column if not exists) — safe to re-run.
--
-- Run this in the Supabase Dashboard SQL Editor against the production
-- project, same manual-migration pattern as 0008/0009/0011/0012.

alter table employer_requirements add column if not exists duration_weeks integer;
alter table employer_requirements add column if not exists hours_per_week integer;
