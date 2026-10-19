-- Provenance for a stored model score (see 0048). llm_criteria_fingerprint is a
-- hash of the requirement fields the model prompt reads; llm_profile_stamp is a
-- hash of the candidate content the model saw. A stored llm_score is reused when
-- the model is unavailable only while both still match, so an opinion about an
-- old posting or an old resume cannot keep shaping the score after either
-- changes. Rows written before this have both null and are never reused. Both
-- nullable; the handlers tolerate their absence until this is applied.
alter table requirement_matches add column if not exists llm_criteria_fingerprint text;
alter table requirement_matches add column if not exists llm_profile_stamp text;
