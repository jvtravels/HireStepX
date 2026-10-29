-- Team candidate reviews (2026-10-29). Idempotent; safe to re-run.
-- Run in the Supabase SQL editor BEFORE deploying the matching code.
--
-- One structured, independent review per teammate per candidate match.
-- Service-role only: RLS is on with no client policies, because teammates'
-- reviews stay hidden until the reader has submitted their own, and that
-- blind rule is enforced in /api/employer-candidate-review, not in a policy.

create table if not exists public.match_reviews (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employers(id) on delete cascade,
  requirement_id uuid not null references public.employer_requirements(id) on delete cascade,
  match_id uuid not null references public.requirement_matches(id) on delete cascade,
  reviewer_user_id uuid not null references auth.users(id) on delete cascade,
  reviewer_email text not null default '',
  -- 1 strong no, 2 lean no, 3 lean yes, 4 strong yes. No neutral midpoint on purpose.
  rating smallint not null check (rating between 1 and 4),
  reason text not null check (char_length(btrim(reason)) between 1 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (match_id, reviewer_user_id)
);
create index if not exists idx_match_reviews_match on public.match_reviews(match_id);
create index if not exists idx_match_reviews_employer on public.match_reviews(employer_id, requirement_id);

alter table public.match_reviews enable row level security; -- service-role only (blind reviews)
