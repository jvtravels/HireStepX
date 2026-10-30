-- Public openings (2026-10-30). Idempotent; safe to re-run.
-- Run in the Supabase SQL editor BEFORE deploying the matching code.
--
-- A role is shown on the public /openings pages only when BOTH keys are on:
--   1. the employer opted in (public_listing = 'employer_ok'), and
--   2. an admin reviewed the public preview and approved it (public_listing = 'approved').
-- Everything defaults to 'off', so applying this changes nothing for live roles.
-- Only the columns on the allowlist in server-handlers/_public-openings-helpers.ts
-- are ever read for the public pages; description, target companies and the
-- other free-text fields are never selected.

alter table public.employer_requirements
  add column if not exists public_listing text not null default 'off'
    check (public_listing in ('off', 'employer_ok', 'approved'));
-- Admin-written one-line summary and optional title override (scrubs any company
-- name an employer typed into the title). Both are what the public sees.
alter table public.employer_requirements add column if not exists public_summary text
  check (public_summary is null or char_length(public_summary) <= 280);
alter table public.employer_requirements add column if not exists public_title text
  check (public_title is null or char_length(public_title) <= 120);
-- Set on approval; a listing hides itself 45 days later unless admin re-approves.
alter table public.employer_requirements add column if not exists public_approved_at timestamptz;

create index if not exists idx_employer_requirements_public_listing
  on public.employer_requirements(public_listing) where public_listing = 'approved';
