-- 0004 — Session-credit RPC + monotonic lifetime session counter.
--
-- This bundles two launch-blocking guarantees that already live in
-- supabase-schema.sql but were never applied to the live database:
--
--   1. consume_session_credit(): atomic single-credit spend. The old helper
--      did a read-then-write, so two near-simultaneous session starts could
--      both pass the balance>0 check and spend one credit twice. This spends
--      in a single guarded UPDATE; Postgres row-locking serializes it.
--
--   2. sessions_started_lifetime: a high-water counter that only ever goes up.
--      The free-tier cap used to count rows in `sessions`, but a user can
--      delete their own sessions (RLS allows it), which reset the free
--      allotment to zero — effectively unlimited free sessions. This counter
--      is delete-proof and the billing guard forbids lowering it.
--
-- Every statement is idempotent (create-or-replace / if-not-exists /
-- drop-if-exists), so this file is safe to re-run. The column is added BEFORE
-- the functions that reference it, so ordering is safe on a populated DB.

-- ── 1. session_credits table (idempotent) + owner-read RLS ──
create table if not exists session_credits (
  user_id    uuid primary key references profiles(id) on delete cascade,
  balance    integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);
alter table session_credits enable row level security;

drop policy if exists "Users read own session credits" on session_credits;
create policy "Users read own session credits" on session_credits
  for select using ((auth.uid())::text = user_id::text);

-- ── 2. Atomic single-credit spend (service-role only) ──
create or replace function consume_session_credit(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  update session_credits
     set balance = balance - 1,
         updated_at = now()
   where user_id = p_user_id
     and balance > 0;
  get diagnostics affected = row_count;
  return affected > 0;
end;
$$;

revoke all on function consume_session_credit(uuid) from public, anon, authenticated;
grant execute on function consume_session_credit(uuid) to service_role;

-- ── 3. Monotonic lifetime session-start counter ──
alter table profiles add column if not exists sessions_started_lifetime integer not null default 0;

-- Backfill existing users to their current session-row count (greatest() keeps
-- it monotonic if this migration is ever re-run).
update profiles p set sessions_started_lifetime = greatest(
  coalesce(p.sessions_started_lifetime, 0),
  (select count(*) from sessions s where s.user_id = p.id)
);

-- Increment on every session insert. SECURITY DEFINER so it writes profiles
-- regardless of the caller's RLS context. Deletes have no trigger — the count
-- is delete-proof, which is the whole point.
create or replace function bump_sessions_started_lifetime()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update profiles
    set sessions_started_lifetime = sessions_started_lifetime + 1
    where id = new.user_id;
  return new;
end;
$$;

drop trigger if exists trg_bump_sessions_lifetime on sessions;
create trigger trg_bump_sessions_lifetime
  after insert on sessions
  for each row execute function bump_sessions_started_lifetime();

-- ── 4. Billing guard: forbid non-service-role callers from lowering the
--       counter (or editing subscription columns) via a direct PATCH. ──
create or replace function guard_profile_billing_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.role() is 'service_role' for service-key requests, 'authenticated'
  -- (or 'anon') for end-user requests. Only the service role may mutate billing.
  if coalesce(auth.role(), '') <> 'service_role' then
    new.subscription_tier        := old.subscription_tier;
    new.subscription_start       := old.subscription_start;
    new.subscription_end         := old.subscription_end;
    new.razorpay_payment_id      := old.razorpay_payment_id;
    new.razorpay_subscription_id := old.razorpay_subscription_id;
    new.cancel_at_period_end     := old.cancel_at_period_end;
    new.subscription_paused      := old.subscription_paused;
    -- High-water mark: a user may not LOWER it (which would reset their free
    -- allotment). The bump trigger may still raise it by +1.
    if new.sessions_started_lifetime < old.sessions_started_lifetime then
      new.sessions_started_lifetime := old.sessions_started_lifetime;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_profile_billing on profiles;
create trigger trg_guard_profile_billing
  before update on profiles
  for each row execute function guard_profile_billing_columns();
