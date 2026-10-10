-- Employer logos: the bucket was a manual runbook step, and a missing bucket
-- silently dropped every uploaded logo. Create it declaratively (idempotent).
-- employer-profile.ts also creates it on demand, so this is belt and braces.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('employer-logos', 'employer-logos', true, 2000000, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
