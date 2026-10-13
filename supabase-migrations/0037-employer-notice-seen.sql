-- 0037: remember that a candidate has seen the one-time "employers can find
-- your masked profile" dashboard notice (employer discovery stays on by
-- default; the notice + the consent log are how that default is made
-- transparent and withdrawable).
--
-- Optional: /api/candidate-visibility tolerates this column being absent (it
-- falls back to the consent log + a per-device localStorage dismissal), so the
-- code can ship before this is applied. Written only by that handler (service
-- role). Does not change employer_visibility for anyone.
alter table public.profiles add column if not exists employer_notice_seen_at timestamptz;
