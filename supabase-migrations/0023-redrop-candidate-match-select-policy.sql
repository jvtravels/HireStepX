-- Audit fix (2026-10-07): migration 0016 dropped "Candidates view own
-- matches" on requirement_matches for a real reason (the table carries
-- employer-private columns RLS can't hide at the column level). A later
-- edit to supabase-schema.sql silently recreated the policy, so any
-- environment that had supabase-schema.sql re-applied since 0016 has this
-- leak back. Re-drop it unconditionally; supabase-schema.sql no longer
-- recreates it.
drop policy if exists "Candidates view own matches" on requirement_matches;
