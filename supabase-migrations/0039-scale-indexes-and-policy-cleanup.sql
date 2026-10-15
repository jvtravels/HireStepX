-- Scale readiness pass (2026-10-15), from the Supabase performance advisor plus a
-- review of the cron / retention / webhook / admin query paths.
-- Idempotent. Plain CREATE INDEX is used because every table is still small
-- (largest: sessions, ~200 rows) so locks last milliseconds. Once a table passes
-- ~1M rows, run these statements by hand as CREATE INDEX CONCURRENTLY instead.

-- 1) Drop exact-duplicate indexes (each pair indexes the same single column).
DROP INDEX IF EXISTS public.idx_conversations_requirement_id;
DROP INDEX IF EXISTS public.idx_message_flags_message_id;

-- 2) Index the foreign keys the advisor flags as uncovered.
CREATE INDEX IF NOT EXISTS idx_employer_blocks_employer ON public.employer_blocks (employer_id);
CREATE INDEX IF NOT EXISTS idx_employer_reports_match ON public.employer_reports (match_id);
CREATE INDEX IF NOT EXISTS idx_unlock_orders_requirement ON public.employer_unlock_orders (requirement_id);
CREATE INDEX IF NOT EXISTS idx_match_status_events_employer ON public.match_status_events (employer_id);
CREATE INDEX IF NOT EXISTS idx_match_status_events_match ON public.match_status_events (match_id);

-- 3) RLS: evaluate auth.uid() once per query instead of once per row.
ALTER POLICY "Users view own notification prefs" ON public.notification_preferences
  USING ((((select auth.uid()))::text = (user_id)::text));
ALTER POLICY "Users view own consents" ON public.user_consents
  USING ((((select auth.uid()))::text = (user_id)::text));

-- 4) Cron / retention / webhook scans that had no supporting index.
-- Matching cron: open requirements by stage.
CREATE INDEX IF NOT EXISTS idx_employer_requirements_open_stage
  ON public.employer_requirements (stage) WHERE status <> 'closed';
-- Retention cleanup deletes by created_at alone.
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications (created_at);
-- Unread badge / count for the inbox.
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id) WHERE read_at IS NULL AND archived_at IS NULL;
-- Webhook + reconciler look orders up by Razorpay payment id.
CREATE UNIQUE INDEX IF NOT EXISTS uq_unlock_orders_payment
  ON public.employer_unlock_orders (razorpay_payment_id) WHERE razorpay_payment_id IS NOT NULL;
-- Unlock reporting / history windows.
CREATE INDEX IF NOT EXISTS idx_requirement_matches_unlocked_at
  ON public.requirement_matches (unlocked_at) WHERE unlocked;

-- 5) Admin search (ilike '%term%') and keyset pagination by created_at.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
CREATE INDEX IF NOT EXISTS idx_profiles_email_trgm ON public.profiles USING gin (email extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_profiles_name_trgm ON public.profiles USING gin (name extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_profiles_created ON public.profiles (created_at DESC, id);
CREATE INDEX IF NOT EXISTS idx_employer_requirements_title_trgm
  ON public.employer_requirements USING gin (title extensions.gin_trgm_ops);
