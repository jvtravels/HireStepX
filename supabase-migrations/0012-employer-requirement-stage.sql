-- Adds a manually-set hiring-pipeline `stage` to employer_requirements,
-- distinct from the existing `status` column (which tracks AI
-- matching/generation lifecycle: generating/ready/partial/zero/failed/
-- closed, not where the employer actually is in hiring). Employers move a
-- posting through ai_matching -> ready_for_review -> interviewing -> hired
-- from the Jobs table row menu. Idempotent (add column if not exists) —
-- safe to re-run.
--
-- Run this in the Supabase Dashboard SQL Editor against the production
-- project, same manual-migration pattern as 0008/0009/0011.

alter table employer_requirements add column if not exists stage text not null default 'ai_matching' check (stage in ('ai_matching', 'ready_for_review', 'interviewing', 'hired'));

-- Allow the new "stage_changed" activity-log action emitted when an employer
-- moves a requirement's stage from the Jobs table row menu.
alter table employer_requirement_activity drop constraint if exists employer_requirement_activity_action_check;
alter table employer_requirement_activity add constraint employer_requirement_activity_action_check check (action in ('created', 'updated', 'archived', 'reopened', 'stage_changed'));
