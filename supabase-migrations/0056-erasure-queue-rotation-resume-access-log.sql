-- 1. Erasure queue rotation. The nightly erasure cron reads the oldest 25 soft-deleted
--    accounts; 25 accounts whose erasure keeps failing would sit at the head forever and
--    starve every account behind them. The cron now stamps each attempt here and reads
--    never-attempted accounts first, then the least recently attempted. Optional for the
--    code: it falls back to deleted_at ordering until this is applied.
alter table public.profiles add column if not exists erasure_attempted_at timestamptz;
create index if not exists idx_profiles_erasure_queue
  on public.profiles (erasure_attempted_at nulls first, deleted_at)
  where deleted_at is not null;

-- 2. Resume download audit trail. A resume file carries a candidate's real name and
--    contact details, so every signed link an employer is handed is recorded: who, which
--    candidate, which job, when, from where. Rows go with either user on erasure.
--    Optional for the code: a failed insert never blocks the download.
create table if not exists public.resume_access_log (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references auth.users(id) on delete cascade,
  candidate_user_id uuid not null references auth.users(id) on delete cascade,
  match_id uuid not null,
  ip_address text,
  created_at timestamptz not null default now()
);
create index if not exists idx_resume_access_log_candidate on public.resume_access_log (candidate_user_id, created_at desc);
create index if not exists idx_resume_access_log_employer on public.resume_access_log (employer_id, created_at desc);

alter table public.resume_access_log enable row level security; -- service-role only, no client policy
