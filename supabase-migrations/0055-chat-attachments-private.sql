-- 0055: chat-attachments is a private bucket, reachable only through the service role (signed URLs minted by
-- /api/message-attachment-url after a participant check). The bucket was created by hand, so pin its settings
-- here: never public, small files, the same type allowlist the upload handler enforces.
-- storage.objects has RLS on by default; with no policy naming this bucket, anon and authenticated clients are
-- denied, and the service role (which bypasses RLS) is unaffected. Idempotent.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-attachments', 'chat-attachments', false, 8388608,
  array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain','image/png','image/jpeg','image/webp']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Defensive: remove any policy a past manual setup attached to this bucket (a permissive one would bypass the
-- participant check). Policies for other buckets are left alone.
do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and (coalesce(qual, '') ilike '%chat-attachments%' or coalesce(with_check, '') ilike '%chat-attachments%')
  loop
    execute format('drop policy %I on storage.objects', p.policyname);
  end loop;
end $$;
