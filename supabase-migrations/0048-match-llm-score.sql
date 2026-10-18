-- llm_score: the model's raw (un-blended) 0-100 opinion of a match, from the last
-- pass that got one. llm_scored_at: when it was produced. Kept so a pass where the
-- model is unavailable reuses the last opinion instead of falling back to the
-- deterministic score alone, which swung scores (and alerts) across the strong
-- threshold whenever the model flapped. Both nullable; the handlers tolerate
-- their absence until this is applied.
alter table requirement_matches add column if not exists llm_score integer;
alter table requirement_matches add column if not exists llm_scored_at timestamptz;
