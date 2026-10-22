-- 0051: chat tables are service-role only; one report per person per message.
--
-- Why: the employer SELECT policy on conversation_messages let a signed-in
-- employer read the raw table through PostgREST with their own JWT, bypassing
-- the unlock gate and contact redaction in server-handlers/messages.ts. That
-- exposed the candidate's raw body (phone/email) and attachment_path, which is
-- a storage key for a file the employer has not paid to see. Every read and
-- write already goes through the API handlers with the service-role key, and
-- nothing in src/, app/ or lib/ queries these tables with supabase-js or
-- subscribes to them over realtime, so no client policy is needed on either
-- side. RLS stays enabled with no policy = deny for anon/authenticated.
--
-- Idempotent: safe to re-run.

drop policy if exists "Employers view own conversation messages" on public.conversation_messages;
drop policy if exists "Candidates view own conversation messages" on public.conversation_messages;
drop policy if exists "Employers view own conversations" on public.conversations;
drop policy if exists "Candidates view own conversations" on public.conversations;

-- Belt and braces: a future permissive policy must not silently re-open this.
revoke select, insert, update, delete on public.conversation_messages from anon, authenticated;
revoke select, insert, update, delete on public.conversations from anon, authenticated;

-- flag-message.ts de-duplicates with check-then-insert, which two concurrent
-- requests can race. Keep the earliest report per (message, reporter), then
-- enforce it. The reporter's own auto-flag (role 'system') is not a report.
delete from public.message_flags f
 using public.message_flags earlier
 where f.flagged_by_role <> 'system'
   and earlier.flagged_by_role <> 'system'
   and f.message_id = earlier.message_id
   and f.flagged_by = earlier.flagged_by
   and (earlier.created_at, earlier.id) < (f.created_at, f.id);

create unique index if not exists uq_message_flags_reporter
  on public.message_flags (message_id, flagged_by)
  where flagged_by_role <> 'system';
