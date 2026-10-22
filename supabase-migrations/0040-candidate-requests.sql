-- 0040: employer requests for evidence / proof / contact details from a
-- candidate on one match (contact fields, a document or link, a practice
-- answer, a clarification). Replaces the fire-and-forget notification that
-- contact requests used to be: every request is now a row with a status the
-- employer can see and the candidate can resolve.
--
-- Optional: the handlers answer 503 "requests unavailable" and the candidate
-- list endpoint returns no requests while this table is absent, so the code can
-- ship before this is applied. Written only by handlers (service role).
create table if not exists public.candidate_requests (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.requirement_matches(id) on delete cascade,
  requirement_id uuid not null references public.employer_requirements(id) on delete cascade,
  employer_id uuid not null references public.employers(id) on delete cascade,
  candidate_user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('contact', 'document', 'practice', 'clarification')),
  topic text check (topic is null or char_length(topic) <= 120),
  fields text[],
  note text check (note is null or char_length(note) <= 300),
  status text not null default 'pending' check (status in ('pending', 'fulfilled', 'declined', 'cancelled')),
  response_note text check (response_note is null or char_length(response_note) <= 500),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists idx_candidate_requests_match on public.candidate_requests(match_id, created_at desc);
create index if not exists idx_candidate_requests_candidate_pending on public.candidate_requests(candidate_user_id, created_at desc)
  where status = 'pending';
create index if not exists idx_candidate_requests_employer_day on public.candidate_requests(employer_id, created_at desc);
-- One open request per (match, kind, topic): re-asking the same thing is a no-op.
create unique index if not exists uq_candidate_requests_open
  on public.candidate_requests (match_id, kind, (coalesce(topic, '')))
  where status = 'pending';

alter table public.candidate_requests enable row level security;

drop policy if exists "Employers view own requests" on public.candidate_requests;
create policy "Employers view own requests" on public.candidate_requests
  for select using (employer_id = (select auth.uid()));
drop policy if exists "Candidates view own requests" on public.candidate_requests;
create policy "Candidates view own requests" on public.candidate_requests
  for select using (candidate_user_id = (select auth.uid()));
