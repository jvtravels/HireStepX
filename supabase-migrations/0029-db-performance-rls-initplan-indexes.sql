-- DB performance pass (2026-10-10), from the Supabase performance advisor.
-- 1) RLS: wrap auth.*() in (select ...) so it's evaluated once per query, not per row.
-- 2) Index the unindexed foreign keys; drop two exact-duplicate indexes.
-- 3) Drop RLS policies fully covered by an identical/broader permissive policy.
-- Already applied to production; written idempotently so re-running is safe.

ALTER POLICY "Users can delete own events" ON public.calendar_events USING ((((select auth.uid()))::text = (user_id)::text));
ALTER POLICY "Users can insert own events" ON public.calendar_events WITH CHECK ((((select auth.uid()))::text = (user_id)::text));
ALTER POLICY "Users can update own events" ON public.calendar_events USING ((((select auth.uid()))::text = (user_id)::text)) WITH CHECK ((((select auth.uid()))::text = (user_id)::text));
ALTER POLICY "Users can view own events" ON public.calendar_events USING ((((select auth.uid()))::text = (user_id)::text));
ALTER POLICY "Users read own reminder log" ON public.calendar_reminder_log USING ((((select auth.uid()))::text = (user_id)::text));
ALTER POLICY "Candidates view own conversation messages" ON public.conversation_messages USING ((((select auth.uid()))::text = (candidate_user_id)::text));
ALTER POLICY "Employers view own conversation messages" ON public.conversation_messages USING ((((select auth.uid()))::text = (employer_id)::text));
ALTER POLICY "Candidates view own conversations" ON public.conversations USING ((((select auth.uid()))::text = (candidate_user_id)::text));
ALTER POLICY "Employers view own conversations" ON public.conversations USING ((((select auth.uid()))::text = (employer_id)::text));
ALTER POLICY "Users can insert own credibility disputes" ON public.credibility_disputes WITH CHECK ((((select auth.uid()))::text = (user_id)::text));
ALTER POLICY "Users can update own credibility disputes" ON public.credibility_disputes USING ((((select auth.uid()))::text = (user_id)::text));
ALTER POLICY "Users can view own credibility disputes" ON public.credibility_disputes USING ((((select auth.uid()))::text = (user_id)::text));
ALTER POLICY "Users read own credit ledger" ON public.credit_ledger USING ((((select auth.uid()))::text = (user_id)::text));
ALTER POLICY "Employers view own requirement activity" ON public.employer_requirement_activity USING ((((select auth.uid()))::text = (employer_id)::text));
ALTER POLICY "Employers manage own requirements" ON public.employer_requirements USING ((((select auth.uid()))::text = (employer_id)::text)) WITH CHECK ((((select auth.uid()))::text = (employer_id)::text));
ALTER POLICY "Employers manage own profile" ON public.employers USING ((((select auth.uid()))::text = (id)::text)) WITH CHECK ((((select auth.uid()))::text = (id)::text));
ALTER POLICY "Users can delete own feedback" ON public.feedback USING ((((select auth.uid()))::text = user_id));
ALTER POLICY "Users can insert own feedback" ON public.feedback WITH CHECK ((((select auth.uid()))::text = user_id));
ALTER POLICY "Users can manage own feedback" ON public.feedback USING ((((select auth.uid()))::text = user_id));
ALTER POLICY "Users can update own feedback" ON public.feedback USING ((((select auth.uid()))::text = user_id));
ALTER POLICY "Users can view own feedback" ON public.feedback USING ((((select auth.uid()))::text = user_id));
ALTER POLICY "Users read own google sync" ON public.google_calendar_sync USING ((((select auth.uid()))::text = (user_id)::text));
ALTER POLICY "Users can insert own interview turns" ON public.interview_turns WITH CHECK ((((select auth.uid()))::text = (user_id)::text));
ALTER POLICY "Users can insert their own turns" ON public.interview_turns WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Users can read their own turns" ON public.interview_turns USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can view own interview turns" ON public.interview_turns USING ((((select auth.uid()))::text = (user_id)::text));
ALTER POLICY "Users can view own llm usage" ON public.llm_usage USING ((((select auth.uid()))::text = (user_id)::text));
ALTER POLICY "Users update own notifications" ON public.notifications USING ((((select auth.uid()))::text = (user_id)::text)) WITH CHECK ((((select auth.uid()))::text = (user_id)::text));
ALTER POLICY "Users view own notifications" ON public.notifications USING ((((select auth.uid()))::text = (user_id)::text));
ALTER POLICY "Users can view own payments" ON public.payments USING ((((select auth.uid()))::text = (user_id)::text));
ALTER POLICY "Users can update own product ratings" ON public.product_ratings USING ((((select auth.uid()))::text = (user_id)::text)) WITH CHECK ((((select auth.uid()))::text = (user_id)::text));
ALTER POLICY "Users can upsert own product ratings" ON public.product_ratings WITH CHECK ((((select auth.uid()))::text = (user_id)::text));
ALTER POLICY "Users can view own product ratings" ON public.product_ratings USING ((((select auth.uid()))::text = (user_id)::text));
ALTER POLICY "Users can insert own profile" ON public.profiles WITH CHECK ((((select auth.uid()))::text = (id)::text));
ALTER POLICY "Users can update own profile" ON public.profiles USING ((((select auth.uid()))::text = (id)::text));
ALTER POLICY "Users can view own profile" ON public.profiles USING ((((select auth.uid()))::text = (id)::text));
ALTER POLICY "Users can insert own question feedback" ON public.question_feedback WITH CHECK ((((select auth.uid()))::text = (user_id)::text));
ALTER POLICY "Users can update own question feedback" ON public.question_feedback USING ((((select auth.uid()))::text = (user_id)::text));
ALTER POLICY "Users can view own question feedback" ON public.question_feedback USING ((((select auth.uid()))::text = (user_id)::text));
ALTER POLICY "Users can view own referrals" ON public.referrals USING ((((select auth.uid()))::text = (referrer_id)::text));
ALTER POLICY "Users manage own shares" ON public.report_shares USING (((select auth.uid()) = user_id)) WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Candidates view own matches" ON public.requirement_matches USING ((((select auth.uid()))::text = (candidate_user_id)::text));
ALTER POLICY "Employers view own matches" ON public.requirement_matches USING ((EXISTS ( SELECT 1
   FROM employer_requirements r
  WHERE ((r.id = requirement_matches.requirement_id) AND (((select auth.uid()))::text = (r.employer_id)::text)))));
ALTER POLICY "Users insert own versions" ON public.resume_versions WITH CHECK ((EXISTS ( SELECT 1
   FROM resumes r
  WHERE ((r.id = resume_versions.resume_id) AND ((r.user_id)::text = ((select auth.uid()))::text)))));
ALTER POLICY "Users view own versions" ON public.resume_versions USING ((EXISTS ( SELECT 1
   FROM resumes r
  WHERE ((r.id = resume_versions.resume_id) AND ((r.user_id)::text = ((select auth.uid()))::text)))));
ALTER POLICY "Users delete own resumes" ON public.resumes USING ((((select auth.uid()))::text = (user_id)::text));
ALTER POLICY "Users insert own resumes" ON public.resumes WITH CHECK ((((select auth.uid()))::text = (user_id)::text));
ALTER POLICY "Users update own resumes" ON public.resumes USING ((((select auth.uid()))::text = (user_id)::text)) WITH CHECK ((((select auth.uid()))::text = (user_id)::text));
ALTER POLICY "Users view own resumes" ON public.resumes USING ((((select auth.uid()))::text = (user_id)::text));
ALTER POLICY "Users manage own offers" ON public.salary_offers USING (((select auth.uid()) = user_id)) WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Users read own session credits" ON public.session_credits USING ((((select auth.uid()))::text = (user_id)::text));
ALTER POLICY "session_insights_select_own" ON public.session_insights USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can delete own sessions" ON public.sessions USING ((((select auth.uid()))::text = (user_id)::text));
ALTER POLICY "Users can insert own sessions" ON public.sessions WITH CHECK ((((select auth.uid()))::text = (user_id)::text));
ALTER POLICY "Users can view own sessions" ON public.sessions USING ((((select auth.uid()))::text = (user_id)::text));
ALTER POLICY "Users read own support messages" ON public.support_messages USING ((((select auth.uid()))::text = (user_id)::text));
ALTER POLICY "Users manage own outcomes" ON public.user_outcomes USING (((select auth.uid()) = user_id)) WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Only admins can read" ON public.waitlist USING (((select auth.role()) = 'service_role'::text));

-- Cover foreign keys that have no index (speeds joins and cascading deletes).
CREATE INDEX IF NOT EXISTS idx_conversation_messages_sender_id ON conversation_messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_conversations_requirement_id ON conversations (requirement_id);
CREATE INDEX IF NOT EXISTS idx_credibility_disputes_session_id ON credibility_disputes (session_id);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_session_id ON credit_ledger (session_id);
CREATE INDEX IF NOT EXISTS idx_employer_unlock_payments_match_id ON employer_unlock_payments (match_id);
CREATE INDEX IF NOT EXISTS idx_message_flags_flagged_by ON message_flags (flagged_by);
CREATE INDEX IF NOT EXISTS idx_message_flags_message_id ON message_flags (message_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments (user_id);
CREATE INDEX IF NOT EXISTS idx_product_ratings_session_id ON product_ratings (session_id);
CREATE INDEX IF NOT EXISTS idx_question_feedback_session_id ON question_feedback (session_id);
CREATE INDEX IF NOT EXISTS idx_service_usage_user_id ON service_usage (user_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_user_id ON support_messages (user_id);

-- Duplicate (identical) indexes: keep one of each pair.
DROP INDEX IF EXISTS public.idx_calendar_events_google_id;
DROP INDEX IF EXISTS public.idx_payments_razorpay_id;

-- Drop policies fully covered by an identical/broader permissive policy on the same table+action.
DROP POLICY IF EXISTS "Users can delete own feedback" ON public.feedback;
DROP POLICY IF EXISTS "Users can insert own feedback" ON public.feedback;
DROP POLICY IF EXISTS "Users can view own feedback" ON public.feedback;
DROP POLICY IF EXISTS "Users can update own feedback" ON public.feedback;
DROP POLICY IF EXISTS "Users can insert their own turns" ON public.interview_turns;
DROP POLICY IF EXISTS "Users can read their own turns" ON public.interview_turns;
DROP POLICY IF EXISTS "Allow anonymous insert" ON public.waitlist;
DROP POLICY IF EXISTS "Anyone can insert waitlist email" ON public.waitlist;
