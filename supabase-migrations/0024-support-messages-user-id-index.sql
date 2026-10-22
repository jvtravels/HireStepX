-- Audit fix (2026-10-07): support_messages has an RLS SELECT policy
-- filtering on user_id ("Users read own support messages", see
-- supabase-schema.sql) but no index on that column — every "my tickets"
-- read does a full table scan. Same anti-pattern migration 0021 already
-- fixed for daily_quality_report/daily_digests elsewhere; this closes the
-- one instance 0021 missed.
create index if not exists idx_support_messages_user on support_messages (user_id);
