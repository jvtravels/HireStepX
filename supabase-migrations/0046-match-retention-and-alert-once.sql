-- missed_passes: consecutive re-match passes in which a locked match did not
-- make the fresh ranking. A row is only removed after several misses so one
-- noisy (LLM-blended) score near the cutoff can't drop a candidate.
-- strong_alerted_at: set when a "new strong match" alert has been sent for the
-- row, so the same candidate is never announced twice.
alter table requirement_matches add column if not exists missed_passes integer not null default 0;
alter table requirement_matches add column if not exists strong_alerted_at timestamptz;
update requirement_matches set strong_alerted_at = now() where match_score >= 40 and strong_alerted_at is null;
