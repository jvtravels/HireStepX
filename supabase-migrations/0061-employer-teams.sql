-- Employer teams (2026-10-26). Idempotent; safe to re-run.
-- Run in the Supabase SQL editor BEFORE deploying the matching code.
--
-- A company (employers.id) can have many users. employers.id stays the company
-- id (it is also the original owner's auth user id), so every existing
-- employer_id foreign key keeps working untouched.
--
--  1. employer_members   who belongs to which company, and with what role
--  2. employer_invites   pending invitations (token stored hashed, single-use)
--  3. employer_audit_log append-only record of who did what
--  4. actor columns      who created / paid / unlocked (previously the company)
--  5. backfill           every existing company gets its owner as a member
--  6. RLS                select-only for client JWTs, like the rest of the employer tables
--  7. detach             a company no longer dies with its original owner's login

-- ── 1. members ──────────────────────────────────────────────────────────
create table if not exists public.employer_members (
  employer_id uuid not null references public.employers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member', 'viewer')),
  -- Snapshots taken when the member joins, so the roster and audit trail need
  -- no auth.users lookups (and survive an email change at the identity layer).
  email text not null default '',
  name text,
  invited_by uuid references auth.users(id) on delete set null,
  joined_at timestamptz not null default now(),
  last_active_at timestamptz,
  primary key (employer_id, user_id)
);
-- v1 is one company per user. Dropping this index is the only schema change
-- needed to allow multi-company membership later.
create unique index if not exists uq_employer_members_user on public.employer_members(user_id);
create index if not exists idx_employer_members_employer on public.employer_members(employer_id, joined_at);

-- ── 2. invites ──────────────────────────────────────────────────────────
create table if not exists public.employer_invites (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employers(id) on delete cascade,
  email text not null check (email = lower(email)),
  role text not null check (role in ('admin', 'member', 'viewer')),
  -- sha-256 hex of the emailed token; the raw token is never stored.
  token_hash text not null unique,
  invited_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
-- At most one live invite per (company, email); re-inviting replaces it.
create unique index if not exists uq_employer_invites_pending
  on public.employer_invites(employer_id, email)
  where accepted_at is null and revoked_at is null;
create index if not exists idx_employer_invites_employer on public.employer_invites(employer_id, created_at desc);

-- ── 3. audit log ────────────────────────────────────────────────────────
-- actor_user_id has no FK on purpose: the trail must outlive a deleted user.
-- actor_email / actor_name are snapshots for the same reason.
create table if not exists public.employer_audit_log (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employers(id) on delete cascade,
  actor_user_id uuid,
  actor_email text,
  action text not null,
  entity_type text,
  entity_id text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_employer_audit_employer on public.employer_audit_log(employer_id, created_at desc);
create index if not exists idx_employer_audit_actor on public.employer_audit_log(employer_id, actor_user_id, created_at desc);

-- ── 4. actor columns ────────────────────────────────────────────────────
-- Nullable: rows written before teams existed have no individual actor and
-- are attributed to the company owner at read time.
alter table public.employer_requirements         add column if not exists created_by uuid;
alter table public.employer_requirement_activity add column if not exists actor_user_id uuid;
alter table public.requirement_matches           add column if not exists unlocked_by uuid;
alter table public.employer_unlock_payments      add column if not exists paid_by uuid;
-- These two tables come from 0032 (employer trust hardening); attribute them
-- when they exist so this migration also runs on a database without it.
do $$
begin
  if to_regclass('public.employer_unlock_orders') is not null then
    alter table public.employer_unlock_orders add column if not exists created_by uuid;
  end if;
  if to_regclass('public.match_status_events') is not null then
    alter table public.match_status_events add column if not exists actor_user_id uuid;
  end if;
end $$;
-- Read by the team handlers to freeze team changes on a suspended company.
-- Same definition as 0032, so whichever migration runs first wins harmlessly.
alter table public.employers add column if not exists suspended_at timestamptz;

-- ── 5. backfill ─────────────────────────────────────────────────────────
insert into public.employer_members (employer_id, user_id, role, email, name, joined_at)
  select e.id, e.id, 'owner', lower(coalesce(u.email, '')),
         nullif(coalesce(u.raw_user_meta_data->>'name', u.raw_user_meta_data->>'full_name', ''), ''),
         coalesce(e.created_at, now())
  from public.employers e
  join auth.users u on u.id = e.id
on conflict do nothing;

-- ── 6. RLS ──────────────────────────────────────────────────────────────
-- All writes are service-role (the /api/employer-team* handlers); client JWTs
-- can only read. security definer helpers avoid recursive policy evaluation.
create or replace function public.employer_role_of(p_employer uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.employer_members
  where employer_id = p_employer and user_id = (select auth.uid())
$$;
revoke execute on function public.employer_role_of(uuid) from public, anon;
grant execute on function public.employer_role_of(uuid) to authenticated;

alter table public.employer_members enable row level security;
drop policy if exists "Members view own company roster" on public.employer_members;
create policy "Members view own company roster" on public.employer_members
  for select using (public.employer_role_of(employer_id) is not null);

alter table public.employer_invites enable row level security; -- service-role only (tokens)

alter table public.employer_audit_log enable row level security;
drop policy if exists "Owners and admins view audit log" on public.employer_audit_log;
create policy "Owners and admins view audit log" on public.employer_audit_log
  for select using (public.employer_role_of(employer_id) in ('owner', 'admin'));

-- Teammates must be able to read the company row they belong to.
drop policy if exists "Members view own company" on public.employers;
create policy "Members view own company" on public.employers
  for select using (public.employer_role_of(id) is not null);

-- ── 7. detach the company from its founder's login ──────────────────────
-- employers.id used to reference auth.users ON DELETE CASCADE, so deleting the
-- founder's account would silently delete the whole company, its jobs, its
-- unlock ledger and every teammate's access. employers.id keeps the same
-- value; only the cascade goes. delete-account / cleanup-deleted-accounts now
-- remove the company explicitly, and only when its last member leaves.
alter table public.employers drop constraint if exists employers_id_fkey;
