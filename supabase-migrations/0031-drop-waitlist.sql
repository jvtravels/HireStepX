-- Product is live; the pre-launch waitlist and its /api/waitlist-signup
-- endpoint are removed. Emails were exported to CSV before this ran.
drop table if exists public.waitlist;
