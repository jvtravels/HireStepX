-- Stamps when a profile field that feeds employer matching last changed (role,
-- industry, resume, employer visibility, deletion). profiles.updated_at cannot
-- serve: every write bumps it (streaks, device tokens, credits), so a sweep
-- keyed on it would rescan every requirement every night. The nightly rematch
-- cron compares the newest stamp with each requirement's last_matched_at and
-- skips requirements nothing changed for. Optional for the code: without this
-- column the cron treats every open requirement as due, as before.
alter table profiles add column if not exists matching_inputs_changed_at timestamptz;

create index if not exists idx_profiles_matching_inputs_changed_at
  on profiles (matching_inputs_changed_at desc)
  where matching_inputs_changed_at is not null;

-- The trigger owns the column: a client-supplied value is discarded, and an
-- update that touches none of the matching inputs keeps the previous stamp.
create or replace function profiles_stamp_matching_inputs()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.matching_inputs_changed_at := now();
  elsif (new.target_role is distinct from old.target_role)
     or (new.industry is distinct from old.industry)
     or (new.resume_data is distinct from old.resume_data)
     or (new.employer_visibility is distinct from old.employer_visibility)
     or (new.deleted_at is distinct from old.deleted_at) then
    new.matching_inputs_changed_at := now();
  else
    new.matching_inputs_changed_at := old.matching_inputs_changed_at;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_stamp_matching_inputs on profiles;
create trigger trg_profiles_stamp_matching_inputs
  before insert or update on profiles
  for each row execute function profiles_stamp_matching_inputs();
