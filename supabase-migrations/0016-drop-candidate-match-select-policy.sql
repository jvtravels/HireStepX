-- Candidates could previously read requirement_matches directly via
-- supabase-js: "Candidates view own matches" was a row-level policy, but
-- requirement_matches carries employer-private columns (candidate_status,
-- candidate_status_note, match_score/roster_score, interview_scheduled_at)
-- that RLS can't hide at the column level. The only legitimate candidate-
-- facing consumer, candidate-hiring-activity.ts, already reads through
-- serviceHeaders() (service role, bypasses RLS) and selects a safe column
-- subset — no code path uses the anon-key/client-side policy this drops.
drop policy if exists "Candidates view own matches" on requirement_matches;
