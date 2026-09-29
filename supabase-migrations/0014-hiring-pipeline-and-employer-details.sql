-- Per-candidate hiring pipeline + employer-requirement metadata (2026-09-29).
-- Closes gaps found in a Figma audit of the employer console: a real
-- per-candidate status (shortlisted -> interview_invited -> interviewing ->
-- hired/rejected/not_a_fit/no_response), an archive reason/disposition
-- captured from the Jobs table row menu, and a free-text department label.
-- Idempotent (add column if not exists) — safe to re-run.
--
-- Run this in the Supabase Dashboard SQL Editor against the production
-- project, same manual-migration pattern as 0008/0009/0011/0012/0013.

-- Free-text department label — employers type their own, no fixed enum:
-- department taxonomies vary too much across employers to be worth a
-- controlled list.
alter table employer_requirements add column if not exists department text;

-- Archive reason/disposition — captured when an employer archives a
-- posting via the Jobs table row menu. archive_disposition drives whether
-- the still-open candidate pipeline for this requirement gets bulk-rejected
-- on archive (see employer-requirement-detail.ts handleStatusAction) or
-- left as-is for the employer to keep working.
alter table employer_requirements add column if not exists archive_reason text;
alter table employer_requirements add column if not exists archive_disposition text check (archive_disposition in ('keep_candidates', 'reject_remaining'));

-- Per-candidate hiring-pipeline status — distinct from the
-- requirement-level `stage`: this tracks where THIS candidate stands
-- within the posting (shortlisted through hired/rejected), set by the
-- employer via employer-candidate-status.ts. candidate_status_note carries
-- free-text notes for both an interview-invite reason and a final-outcome
-- note (see the outcome-feedback page) — one column, since only one note
-- is ever "current" for a candidate at a time. interview_scheduled_at is
-- optional and only meaningful once status is interview_invited/interviewing.
alter table requirement_matches add column if not exists candidate_status text not null default 'shortlisted' check (candidate_status in ('shortlisted', 'interview_invited', 'interviewing', 'hired', 'rejected', 'not_a_fit', 'no_response'));
alter table requirement_matches add column if not exists candidate_status_note text;
alter table requirement_matches add column if not exists candidate_status_updated_at timestamptz;
alter table requirement_matches add column if not exists interview_scheduled_at timestamptz;
