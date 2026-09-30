-- Batch unlock pricing (2026-10-01): candidates now unlock in fixed
-- batches of UNLOCK_BUNDLE_SIZE (10) for a flat ₹299 per batch (see the
-- "Employers" design canvas, EmployersDashboard.tsx), replacing the old
-- ₹999 / ₹1,999 tiered per-candidate paywall in _unlock-pricing.ts. A
-- lone candidate can still be unlocked on its own at a discounted ₹59.
-- One Razorpay payment can now cover a whole batch (multiple matches),
-- so employer_unlock_payments needs to record a set of match ids, not
-- just one.
--
-- Run this in the Supabase Dashboard SQL Editor against the production
-- project, same manual-migration pattern as 0008/.../0014.

alter table employer_unlock_payments alter column match_id drop not null;
alter table employer_unlock_payments add column if not exists match_ids uuid[];

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'employer_unlock_payments_match_xor'
  ) then
    alter table employer_unlock_payments
      add constraint employer_unlock_payments_match_xor
      check ((match_id is not null) <> (match_ids is not null));
  end if;
end $$;
