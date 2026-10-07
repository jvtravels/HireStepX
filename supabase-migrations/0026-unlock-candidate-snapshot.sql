-- Audit fix (2026-10-07): requirement_matches.candidate_user_id references
-- profiles(id) on delete cascade, so a candidate deleting their account
-- erases the match row entirely — including any paid unlock on it — leaving
-- an unexplained charge in the employer's "Unlock history" with no way to
-- tell who it was for. Snapshotting the candidate's name/email at unlock
-- time (populated in employer-verify-unlock-payment.ts) survives that
-- cascade; existing unlocked rows predate this column and stay null, which
-- the read path falls back to "Candidate" for, same as today.
alter table requirement_matches add column if not exists unlocked_candidate_name text;
alter table requirement_matches add column if not exists unlocked_candidate_email text;
