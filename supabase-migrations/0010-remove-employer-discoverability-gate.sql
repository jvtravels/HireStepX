-- Removes the candidate opt-in gate for the employer talent-roster matching
-- pool. Employers now match against every candidate profile by default;
-- there is no more "Visible to employers" toggle in Settings.
--
-- Run this in the Supabase Dashboard SQL Editor against the production
-- project (see the same manual-migration pattern used in 0008).

alter table profiles drop column if exists is_discoverable_to_employers;
