-- calendar-save writes `role`; the column existed only in supabase-schema.sql,
-- so prod silently stripped it and the mock-interview prefill lost the role.
alter table calendar_events add column if not exists role text default '';
