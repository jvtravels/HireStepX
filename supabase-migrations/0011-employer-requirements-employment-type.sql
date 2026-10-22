-- Adds employment_type to employer_requirements. This column has been in
-- supabase-schema.sql since it was introduced but was never split into a
-- numbered migration, so it was never applied to production — every read
-- of /api/candidate-hiring-activity (the Jobs tab's data source) selects
-- it and 500s with "column employer_requirements.employment_type does not
-- exist" the moment a candidate has any requirement_matches row. The
-- frontend swallows that 500 and renders the "No matches yet" empty state,
-- which is why the Jobs table looks empty even for candidates with real
-- matches. Idempotent (add column if not exists) — safe to re-run.
--
-- Run this in the Supabase Dashboard SQL Editor against the production
-- project, same manual-migration pattern as 0008-employer-tables.sql and
-- 0009-requirement-experience-due-date.sql.

alter table employer_requirements add column if not exists employment_type text default 'full-time' check (employment_type in ('full-time', 'part-time', 'contract', 'internship'));
