-- 0003 — Add resume_snapshot to session_insights.
--
-- The analyze-sessions cron loads the user's resume by resume_version_id
-- and threads it into the per-focus analyzer for cross-checks (resume vs.
-- transcript employer / gap / seniority mismatches). Persisting the same
-- normalized snapshot on session_insights lets the dashboard render
-- "we cross-checked your transcript against THIS view of your resume"
-- without re-running the parser, and lets future analyzers deepen the
-- cross-check without another fetch.
--
-- Nullable on purpose — sessions without a linked resume_version_id will
-- still produce an insight row with resume_snapshot = NULL.

alter table session_insights
  add column if not exists resume_snapshot jsonb;
