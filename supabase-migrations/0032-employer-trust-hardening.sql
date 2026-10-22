-- Employer-side trust hardening (2026-10-10). Idempotent; safe to re-run.
-- Run in the Supabase SQL editor BEFORE deploying the matching code.
--
--  1. sessions: no client writes (forged-score fix) + column guard trigger
--  2. employers / employer_requirements: server-only writes (select-only RLS)
--  3. employers: verification tier, suspension, GSTIN
--  4. profiles: candidate employer-visibility consent + append-only consent log
--  5. candidate agency: employer_blocks, employer_reports, match response
--  6. match_status_events: audit trail of pipeline transitions
--  7. employer_unlock_orders + invoice numbering on employer_unlock_payments
--  8. indexes

-- ── 1. sessions ─────────────────────────────────────────────────────────
-- Scores are what employers pay for. The only writers are the service-role
-- handlers (/api/sessions/save, /api/evaluate-session). A client INSERT
-- policy let any user forge score / skill_scores / report_json directly via
-- PostgREST, so it is dropped, and a trigger keeps it that way even if a
-- later schema re-run recreates a policy.
drop policy if exists "Users can insert own sessions" on public.sessions;

create or replace function public.guard_session_grade_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.role() is NULL for the SQL editor / migrations, 'service_role' for
  -- the server handlers; only end-user JWT roles are restricted.
  if coalesce(auth.role(), '') in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      raise exception 'sessions are written by the server only' using errcode = '42501';
    end if;
    new.score                := old.score;
    new.skill_scores         := old.skill_scores;
    new.report_json          := old.report_json;
    new.report_version       := old.report_version;
    new.report_generated_at  := old.report_generated_at;
    new.ai_feedback          := old.ai_feedback;
    new.transcript           := old.transcript;
    new.user_id              := old.user_id;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_guard_session_grade on public.sessions;
create trigger trg_guard_session_grade
  before insert or update on public.sessions
  for each row execute function public.guard_session_grade_columns();
revoke execute on function public.guard_session_grade_columns() from public, anon, authenticated;

-- ── 2. employers / employer_requirements: select-only for client JWTs ───
-- The app never writes these tables from the browser; a "for all" policy let
-- an employer PATCH their own verification tier / status via PostgREST.
drop policy if exists "Employers manage own profile" on public.employers;
drop policy if exists "Employers view own profile" on public.employers;
create policy "Employers view own profile" on public.employers
  for select using (((select auth.uid()))::text = (id)::text);

drop policy if exists "Employers manage own requirements" on public.employer_requirements;
drop policy if exists "Employers view own requirements" on public.employer_requirements;
create policy "Employers view own requirements" on public.employer_requirements
  for select using (((select auth.uid()))::text = (employer_id)::text);

-- ── 3. employers: verification tier, suspension, billing identity ───────
alter table public.employers add column if not exists verification_tier text not null default 'basic'
  check (verification_tier in ('basic', 'email_verified', 'verified'));
alter table public.employers add column if not exists verified_at timestamptz;
alter table public.employers add column if not exists suspended_at timestamptz;
alter table public.employers add column if not exists suspended_reason text;
alter table public.employers add column if not exists gstin text;
alter table public.employers add column if not exists billing_name text;
-- Grandfather employers that existed before tiers: they keep unlocking as
-- 'email_verified'. New signups start at 'basic' and are promoted server-side.
update public.employers set verification_tier = 'email_verified', verified_at = coalesce(verified_at, now())
  where verification_tier = 'basic' and created_at < now() - interval '1 minute';

-- ── 4. candidate consent to employer discovery (DPDP Act 2023) ──────────
-- 'masked' = appears to employers with name/contact/employer-identifying
-- detail hidden until the employer pays to unlock (today's behaviour).
-- 'off'    = never matched, viewed or messaged by employers.
-- Existing users default to 'masked' (current behaviour); they are told and
-- can switch off at /settings. Changes go through /api/candidate-visibility
-- (service role) so the consent log below is always accurate.
alter table public.profiles add column if not exists employer_visibility text not null default 'masked'
  check (employer_visibility in ('masked', 'off'));
alter table public.profiles add column if not exists employer_visibility_updated_at timestamptz;

create table if not exists public.candidate_consent_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  purpose text not null default 'employer_discovery',
  action text not null check (action in ('granted', 'withdrawn')),
  policy_version text not null,
  source text not null default 'settings',
  created_at timestamptz not null default now()
);
create index if not exists idx_candidate_consent_log_user on public.candidate_consent_log(user_id, created_at desc);
alter table public.candidate_consent_log enable row level security;
drop policy if exists "Users read own consent log" on public.candidate_consent_log;
create policy "Users read own consent log" on public.candidate_consent_log
  for select using (((select auth.uid()))::text = (user_id)::text);

create or replace function public.guard_profile_consent_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') in ('authenticated', 'anon') then
    new.employer_visibility := old.employer_visibility;
    new.employer_visibility_updated_at := old.employer_visibility_updated_at;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_guard_profile_consent on public.profiles;
create trigger trg_guard_profile_consent
  before update on public.profiles
  for each row execute function public.guard_profile_consent_columns();
revoke execute on function public.guard_profile_consent_columns() from public, anon, authenticated;

-- ── 5. candidate agency ─────────────────────────────────────────────────
create table if not exists public.employer_blocks (
  candidate_user_id uuid not null references public.profiles(id) on delete cascade,
  employer_id uuid not null references public.employers(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (candidate_user_id, employer_id)
);
alter table public.employer_blocks enable row level security;
drop policy if exists "Candidates view own blocks" on public.employer_blocks;
create policy "Candidates view own blocks" on public.employer_blocks
  for select using (((select auth.uid()))::text = (candidate_user_id)::text);

create table if not exists public.employer_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references public.profiles(id) on delete cascade,
  employer_id uuid not null references public.employers(id) on delete cascade,
  match_id uuid references public.requirement_matches(id) on delete set null,
  reason text not null check (reason in ('spam', 'fake_company', 'harassment', 'off_platform_solicitation', 'discriminatory', 'other')),
  note text,
  status text not null default 'open' check (status in ('open', 'reviewed', 'actioned', 'dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (reporter_user_id, employer_id)
);
create index if not exists idx_employer_reports_employer on public.employer_reports(employer_id, status);
create index if not exists idx_employer_reports_status on public.employer_reports(status, created_at desc);
alter table public.employer_reports enable row level security; -- admin/service-role only

alter table public.requirement_matches add column if not exists candidate_response text not null default 'none'
  check (candidate_response in ('none', 'interested', 'declined'));
alter table public.requirement_matches add column if not exists candidate_responded_at timestamptz;

-- ── 6. pipeline audit trail ─────────────────────────────────────────────
create table if not exists public.match_status_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references public.requirement_matches(id) on delete set null,
  requirement_id uuid references public.employer_requirements(id) on delete cascade not null,
  employer_id uuid references public.employers(id) on delete cascade not null,
  candidate_user_id uuid references public.profiles(id) on delete cascade not null,
  from_status text,
  to_status text not null,
  actor text not null check (actor in ('employer', 'candidate', 'system')),
  note text,
  created_at timestamptz not null default now()
);
create index if not exists idx_match_status_events_candidate on public.match_status_events(candidate_user_id, created_at desc);
create index if not exists idx_match_status_events_requirement on public.match_status_events(requirement_id, created_at desc);
alter table public.match_status_events enable row level security; -- service-role only; candidates read via API

-- ── 7. unlock orders (webhook-first payments) + invoices ────────────────
create sequence if not exists public.employer_invoice_seq;

create table if not exists public.employer_unlock_orders (
  id uuid primary key default gen_random_uuid(),
  razorpay_order_id text unique not null,
  employer_id uuid not null references public.employers(id) on delete cascade,
  requirement_id uuid references public.employer_requirements(id) on delete set null,
  mode text not null check (mode in ('single', 'batch')),
  match_ids uuid[] not null,
  amount integer not null,
  currency text not null default 'INR',
  status text not null default 'created'
    check (status in ('created', 'paid', 'fulfilled', 'partial', 'refunded', 'disputed', 'expired', 'failed')),
  razorpay_payment_id text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  fulfilled_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists idx_unlock_orders_employer on public.employer_unlock_orders(employer_id, created_at desc);
create index if not exists idx_unlock_orders_open on public.employer_unlock_orders(status, created_at)
  where status in ('created', 'paid');
-- At most one open single-candidate order per (employer, match) — replaces
-- the 90s Redis lock that failed open when Upstash was unavailable.
create unique index if not exists uq_unlock_orders_open_single
  on public.employer_unlock_orders (employer_id, (match_ids[1]))
  where mode = 'single' and status in ('created', 'paid');
alter table public.employer_unlock_orders enable row level security; -- service-role only

alter table public.employer_unlock_payments add column if not exists requirement_id uuid;
alter table public.employer_unlock_payments add column if not exists invoice_no text
  default ('HSX-' || to_char(now(), 'YYMM') || '-' || lpad(nextval('public.employer_invoice_seq')::text, 6, '0'));
alter table public.employer_unlock_payments add column if not exists refunded_at timestamptz;

-- ── 8. indexes ──────────────────────────────────────────────────────────
create index if not exists idx_conversations_requirement on public.conversations(requirement_id);
create index if not exists idx_message_flags_message on public.message_flags(message_id);
create index if not exists idx_requirement_matches_status on public.requirement_matches(candidate_user_id, candidate_status);
create index if not exists idx_sessions_user_graded on public.sessions(user_id, report_generated_at desc)
  where report_generated_at is not null;
