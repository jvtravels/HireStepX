-- 0021: DB fixes from the 2026-10-07 architecture/code-quality audit.
-- Idempotent — safe to re-run.

-- ═══════════════════════════════════════════════════════
-- 1. Document the service-role-only intent on tables that have RLS
--    enabled with no policy. Functionally a no-op (RLS-enabled-no-policy
--    already denies all non-service-role access), but these four were
--    missing the "this is intentional" comment every sibling table
--    (payment_dedup, service_usage, employer_unlock_payments) carries —
--    without it, a future reader can't tell "locked down on purpose"
--    from "policy forgotten".
-- ═══════════════════════════════════════════════════════

comment on table daily_quality_report is
  'Service-role-only: written by the nightly quality cron, read only via '
  'the admin dashboard using the service key. RLS enabled with no '
  'authenticated/anon policy is intentional, not an oversight.';

comment on table daily_digests is
  'Service-role-only: written by the nightly quality cron. RLS enabled '
  'with no authenticated/anon policy is intentional — internal admin '
  'tooling only, no end-user surface.';

comment on table prompt_revisions is
  'Service-role-only: admin-logged prompt-change markers, read by the '
  'quality cron for before/after comparisons. RLS enabled with no '
  'authenticated/anon policy is intentional, not an oversight.';

comment on table quality_recommendations is
  'Service-role-only: auto-generated fix recommendations surfaced on the '
  'admin dashboard via the service key. RLS enabled with no '
  'authenticated/anon policy is intentional, not an oversight.';

-- ═══════════════════════════════════════════════════════
-- 2. Missing indexes on RLS-filtered columns.
-- ═══════════════════════════════════════════════════════

-- requirement_matches: the "Candidates view own matches" policy filters
-- directly on candidate_user_id with no supporting index — every
-- candidate-side read was a full table scan.
create index if not exists idx_requirement_matches_candidate
  on requirement_matches(candidate_user_id, created_at desc);

-- employer_requirement_activity: the "Employers view own requirement
-- activity" policy filters on employer_id, which only had an index on
-- (requirement_id, created_at) — not employer_id.
create index if not exists idx_employer_requirement_activity_employer
  on employer_requirement_activity(employer_id, created_at desc);

-- ═══════════════════════════════════════════════════════
-- 3. profiles.updated_at — the most frequently mutated table in the
--    app (billing, streak counters, onboarding flags, resume pointer,
--    portfolio links) had no last-modified column, unlike every other
--    mutable table (calendar_events, resumes, google_calendar_sync).
-- ═══════════════════════════════════════════════════════

alter table profiles add column if not exists updated_at timestamptz default now();

-- Bump it inside the existing BEFORE-UPDATE guard trigger rather than
-- adding a second trigger — guard_profile_billing_columns() already
-- fires on every profiles UPDATE, so this is the cheapest place to keep
-- updated_at honest regardless of which columns changed or which role
-- made the write.
create or replace function guard_profile_billing_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    new.subscription_tier        := old.subscription_tier;
    new.subscription_start       := old.subscription_start;
    new.subscription_end         := old.subscription_end;
    new.razorpay_payment_id      := old.razorpay_payment_id;
    new.razorpay_subscription_id := old.razorpay_subscription_id;
    new.cancel_at_period_end     := old.cancel_at_period_end;
    new.subscription_paused      := old.subscription_paused;
    if new.sessions_started_lifetime < old.sessions_started_lifetime then
      new.sessions_started_lifetime := old.sessions_started_lifetime;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
