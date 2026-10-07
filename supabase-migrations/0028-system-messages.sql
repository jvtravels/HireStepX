-- Allow a conversation message to be auto-posted by the platform itself
-- (2026-10-07) — e.g. "Interview invite sent for Oct 15" when an employer
-- changes a candidate's pipeline status from the messages thread. Widens
-- the existing employer/candidate check constraint rather than adding a
-- new column, since sender_role already carries exactly this distinction.
alter table conversation_messages drop constraint if exists conversation_messages_sender_role_check;
alter table conversation_messages add constraint conversation_messages_sender_role_check
  check (sender_role in ('employer', 'candidate', 'system'));
