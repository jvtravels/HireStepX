-- Stamped at the start of every runMatching attempt, whether it succeeds or
-- not. last_matched_at only moves on success, so a requirement that keeps
-- failing stayed the "stalest" row forever and a capped sweep read never got
-- past it to the live requirements behind it. The incremental and nightly
-- sweeps now order by this column first. Optional for the code: handlers fall
-- back to last_matched_at ordering until this is applied.
alter table employer_requirements add column if not exists last_rematch_attempt_at timestamptz;
create index if not exists idx_employer_requirements_rematch_order
  on employer_requirements (last_rematch_attempt_at nulls first, last_matched_at nulls first)
  where status <> 'closed';
