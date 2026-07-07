-- 0007 — Composite index for the per-user, per-type session query.
--
-- fetchSkillProgressTrends (src/dashboardData.ts) filters sessions by
--   user_id = $1 AND type = 'salary-negotiation'
-- then ORDER BY created_at DESC LIMIT N. The existing indexes cover only
-- (user_id, created_at) and (user_id, date), so the type-filtered path falls
-- back to filtering user_id rows and discarding non-matching types in memory —
-- fine today, but it degrades as heavy users accumulate mixed-type sessions.
--
-- (user_id, type, created_at DESC) lets Postgres satisfy the equality predicate
-- AND the ordered LIMIT from a single index scan. The non-negotiation path
-- (user_id only, no type filter) still uses idx_sessions_user_created.
--
-- Idempotent (if-not-exists), so safe to re-run.
create index if not exists idx_sessions_user_type_created
  on sessions (user_id, type, created_at desc);
