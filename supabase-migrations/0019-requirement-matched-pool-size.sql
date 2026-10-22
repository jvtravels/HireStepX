-- True size of the floor-filtered matched-candidate pool at the last
-- matching pass (rankAndCap's totalMatched), before the pool gets capped
-- at 20 and persisted to requirement_matches. Lets the Jobs/detail UI show
-- "Top 20 (of 45 matched)" instead of reporting the post-cap count as if
-- it were the whole pool. Set alongside `status` in runMatching
-- (employer-requirements.ts); defaults to 0 for any row from before this
-- column existed, until the next create/edit re-runs matching.
alter table employer_requirements add column if not exists matched_pool_size integer not null default 0;
