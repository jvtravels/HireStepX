-- The waitlist table holds visitor emails. Production had drifted from the
-- schema's intent ("anonymous SELECT is intentionally NOT granted") with a
-- USING (true) policy for anon, letting anyone read every row. The only
-- reader was the unmounted ComingSoon live-counter, which is removed.
-- Inserts still go through /api/waitlist-signup (service role).
drop policy if exists "Allow anonymous count" on public.waitlist;
