-- Employer talent-roster tables (employers, employer_requirements,
-- requirement_matches, employer_unlock_payments) plus the
-- profiles.is_discoverable_to_employers opt-in column.
--
-- These were introduced directly in supabase-schema.sql (see the "Employer
-- talent-roster feature" section) rather than through a numbered migration,
-- so they were never applied to production. This file exists to run that
-- DDL against production and to keep a record of it going forward.
-- All statements are idempotent (if not exists / drop-then-create policy).

create table if not exists employers (
  id uuid references auth.users on delete cascade primary key,
  company_name text not null default '',
  website text not null default '',
  gstin text default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  submitted_at timestamptz default now(),
  approved_at timestamptz,
  created_at timestamptz default now()
);

alter table employers enable row level security;
drop policy if exists "Employers manage own profile" on employers;
create policy "Employers manage own profile" on employers
  for all using ((auth.uid())::text = id::text) with check ((auth.uid())::text = id::text);

create table if not exists employer_requirements (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid references employers(id) on delete cascade not null,
  title text not null,
  location text not null default '',
  notice_period_pref text default 'Any',
  description text default '',
  status text not null default 'generating' check (status in ('generating', 'ready', 'partial', 'zero', 'failed', 'closed')),
  created_at timestamptz default now()
);

create index if not exists idx_employer_requirements_employer on employer_requirements(employer_id, created_at desc);

alter table employer_requirements enable row level security;
drop policy if exists "Employers manage own requirements" on employer_requirements;
create policy "Employers manage own requirements" on employer_requirements
  for all using ((auth.uid())::text = employer_id::text) with check ((auth.uid())::text = employer_id::text);

create table if not exists requirement_matches (
  id uuid primary key default gen_random_uuid(),
  requirement_id uuid references employer_requirements(id) on delete cascade not null,
  candidate_user_id uuid references profiles(id) on delete cascade not null,
  match_score integer not null default 0,
  roster_score integer not null default 0,
  unlocked boolean default false,
  unlocked_at timestamptz,
  created_at timestamptz default now(),
  unique (requirement_id, candidate_user_id)
);

create index if not exists idx_requirement_matches_requirement on requirement_matches(requirement_id, match_score desc);

alter table requirement_matches enable row level security;
drop policy if exists "Employers view own matches" on requirement_matches;
create policy "Employers view own matches" on requirement_matches
  for select using (
    exists (
      select 1 from employer_requirements r
      where r.id = requirement_matches.requirement_id
        and (auth.uid())::text = r.employer_id::text
    )
  );
drop policy if exists "Candidates view own matches" on requirement_matches;
create policy "Candidates view own matches" on requirement_matches
  for select using ((auth.uid())::text = candidate_user_id::text);

alter table profiles add column if not exists is_discoverable_to_employers boolean not null default false;

create table if not exists employer_unlock_payments (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references requirement_matches(id) on delete cascade not null,
  employer_id uuid references employers(id) on delete cascade not null,
  razorpay_payment_id text unique not null,
  razorpay_order_id text default '',
  amount integer not null,
  currency text default 'INR',
  status text default 'completed',
  created_at timestamptz default now()
);

create index if not exists idx_employer_unlock_payments_employer on employer_unlock_payments(employer_id, created_at desc);

alter table employer_unlock_payments enable row level security;
