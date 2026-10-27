-- Enforce the 5-person team cap in the database. The handlers check it too, but a
-- read-then-write check can be raced by two simultaneous invites or accepts.
-- Seats = members + live invites (pending, not expired) for the company.
-- A per-company advisory lock serializes the count + insert. Safe to apply before or
-- after the code deploy: the handlers already report the "team_full" error it raises.

create or replace function public.enforce_employer_team_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  seats int;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.employer_id::text, 0));

  if tg_table_name = 'employer_members' then
    -- Accepting an invite converts its own seat, so only members + OTHER live invites count.
    select (select count(*) from public.employer_members where employer_id = new.employer_id)
         + (select count(*) from public.employer_invites
            where employer_id = new.employer_id and accepted_at is null and revoked_at is null
              and expires_at > now() and lower(email) <> lower(new.email))
      into seats;
  else
    select (select count(*) from public.employer_members where employer_id = new.employer_id)
         + (select count(*) from public.employer_invites
            where employer_id = new.employer_id and accepted_at is null and revoked_at is null
              and expires_at > now() and email <> new.email)
      into seats;
  end if;

  if seats >= 5 then
    raise exception 'team_full' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_employer_team_cap() from public, anon, authenticated;

drop trigger if exists trg_employer_members_cap on public.employer_members;
create trigger trg_employer_members_cap
  before insert on public.employer_members
  for each row execute function public.enforce_employer_team_cap();

drop trigger if exists trg_employer_invites_cap on public.employer_invites;
create trigger trg_employer_invites_cap
  before insert on public.employer_invites
  for each row execute function public.enforce_employer_team_cap();
