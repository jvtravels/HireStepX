-- 0005 — Defense-in-depth: add `with check` to user-owned UPDATE policies.
--
-- Context (launch audit 2026-06-21, PRI-57): four RLS UPDATE policies were
-- row-scoped via `using (…)` but omitted the matching `with check (…)`.
-- Without it, an authenticated user could UPDATE a row they own and, in the
-- same statement, re-point its owner column (id / user_id) to ANOTHER user —
-- moving the row out of their own scope. `using` only gates which rows the
-- UPDATE may target; `with check` validates the POST-update row. They must
-- agree for ownership to be enforced on both ends.
--
-- NOTE — scope of this fix: this does NOT restrict which COLUMNS a user may
-- change on their own row (Postgres RLS cannot). The billing-column lockdown
-- (subscription_tier/_end, sessions_started_lifetime, etc.) is enforced by the
-- guard_profile_billing_columns() BEFORE-UPDATE trigger shipped in migration
-- 0004 — apply 0004 first if it is not yet live (see PRI-41 / PRI-57).
--
-- Idempotent: every policy is dropped-if-exists then recreated. Safe to re-run.

-- profiles
drop policy if exists "Users can update own profile" on profiles;
create policy "Users can update own profile" on profiles
  for update using ((auth.uid())::text = id::text)
  with check ((auth.uid())::text = id::text);

-- feedback
drop policy if exists "Users can update own feedback" on feedback;
create policy "Users can update own feedback" on feedback
  for update using ((auth.uid())::text = user_id::text)
  with check ((auth.uid())::text = user_id::text);

-- question_feedback
drop policy if exists "Users can update own question feedback" on question_feedback;
create policy "Users can update own question feedback" on question_feedback
  for update using ((auth.uid())::text = user_id::text)
  with check ((auth.uid())::text = user_id::text);

-- credibility_disputes
drop policy if exists "Users can update own credibility disputes" on credibility_disputes;
create policy "Users can update own credibility disputes" on credibility_disputes
  for update using ((auth.uid())::text = user_id::text)
  with check ((auth.uid())::text = user_id::text);
