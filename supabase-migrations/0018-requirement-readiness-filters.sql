-- Employer-set quality floors for candidate matching: skip candidates below
-- a minimum readiness band (strongHire/hire/leanHire) or STAR completeness
-- percentage. Both optional, null means no floor.
alter table employer_requirements add column if not exists min_readiness_band text check (min_readiness_band in ('strongHire', 'hire', 'leanHire'));
alter table employer_requirements add column if not exists min_star_completeness smallint check (min_star_completeness between 0 and 100);
