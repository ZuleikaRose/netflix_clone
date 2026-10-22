-- Screen-time limits: a daily viewing limit per profile (meant for Kids profiles), set with the account password.
-- Time watched is counted per profile and day in public.screen_time, which members read but only change through
-- add_screen_time() (small steps, never down) and add_extra_screen_time() (more time today, with the account
-- password). The player stops once a profile has used its limit for the day.

alter table public.profiles add column daily_limit_minutes smallint
  check (daily_limit_minutes in (30, 60, 90, 120, 180, 240));

-- Like `locked` (migration ..._profile_locks): only set_screen_time_limit() changes the limit, so a Kids profile
-- can't lift its own
create function private.guard_screen_time_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_setting('app.screen_time_limit', true) is distinct from 'on' then
    new.daily_limit_minutes := case when tg_op = 'INSERT' then null else old.daily_limit_minutes end;
  end if;
  return new;
end;
$$;
revoke execute on function private.guard_screen_time_limit() from public, anon, authenticated;
create trigger guard_screen_time_limit before insert or update on public.profiles
  for each row execute function private.guard_screen_time_limit();

-- Sets a profile's daily limit in minutes (null removes it), after checking the account password
create function public.set_screen_time_limit(p_profile uuid, p_minutes integer, p_password text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.second_step_done() then
    raise exception 'Finish signing in first.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.profiles where id = p_profile and user_id = auth.uid()) then
    raise exception 'Profile not found.' using errcode = 'P0001';
  end if;
  if not public.verify_account_password(p_password) then
    raise exception 'Your password is incorrect.' using errcode = 'P0001';
  end if;
  if p_minutes is not null and p_minutes not in (30, 60, 90, 120, 180, 240) then
    raise exception 'Choose a daily limit from the list.' using errcode = 'P0001';
  end if;
  perform set_config('app.screen_time_limit', 'on', true);
  update public.profiles set daily_limit_minutes = p_minutes where id = p_profile;
  perform set_config('app.screen_time_limit', 'off', true);
end;
$$;
revoke execute on function public.set_screen_time_limit(uuid, integer, text) from public, anon;
grant execute on function public.set_screen_time_limit(uuid, integer, text) to authenticated;

-- Seconds watched per profile and (the member's local) day, plus extra time a grown-up allowed that day
create table public.screen_time (
  user_id uuid not null default auth.uid() references public.netflix_tables (id) on delete cascade,
  profile_id uuid not null,
  day date not null,
  seconds integer not null default 0 check (seconds between 0 and 86400),
  extra_seconds integer not null default 0 check (extra_seconds between 0 and 86400),
  updated_at timestamptz not null default now(),
  primary key (profile_id, day),
  foreign key (profile_id, user_id) references public.profiles (id, user_id) on delete cascade
);

grant select on public.screen_time to authenticated;
alter table public.screen_time enable row level security;
create policy "Users read their own rows" on public.screen_time
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Two-step sign-in finished" on public.screen_time as restrictive for all to authenticated
  using ((select public.second_step_done())) with check ((select public.second_step_done()));

-- p_day is the member's local date: it may be a day either side of the database's
create function private.check_screen_time_day(p_profile uuid, p_day date)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not public.second_step_done() then
    raise exception 'Finish signing in first.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.profiles where id = p_profile and user_id = auth.uid()) then
    raise exception 'Profile not found.' using errcode = 'P0001';
  end if;
  if p_day is null or p_day not between current_date - 1 and current_date + 1 then
    raise exception 'That isn''t today.' using errcode = 'P0001';
  end if;
end;
$$;
revoke execute on function private.check_screen_time_day(uuid, date) from public, anon, authenticated;

-- Adds watched time (1 to 60 seconds per call: the player reports every few seconds) and returns the day's row
create function public.add_screen_time(p_profile uuid, p_day date, p_seconds integer)
returns public.screen_time
language plpgsql
security definer
set search_path = ''
as $$
declare
  usage public.screen_time;
begin
  perform private.check_screen_time_day(p_profile, p_day);
  if p_seconds is null or p_seconds not between 1 and 60 then
    raise exception 'Report between 1 and 60 seconds at a time.' using errcode = 'P0001';
  end if;
  insert into public.screen_time (user_id, profile_id, day, seconds) values (auth.uid(), p_profile, p_day, p_seconds)
  on conflict (profile_id, day) do update
    set seconds = least(86400, public.screen_time.seconds + excluded.seconds), updated_at = now()
  returning * into usage;
  return usage;
end;
$$;
revoke execute on function public.add_screen_time(uuid, date, integer) from public, anon;
grant execute on function public.add_screen_time(uuid, date, integer) to authenticated;

-- A grown-up allows more time today (15 to 120 minutes at a time) with the account password; returns the day's row
create function public.add_extra_screen_time(p_profile uuid, p_day date, p_minutes integer, p_password text)
returns public.screen_time
language plpgsql
security definer
set search_path = ''
as $$
declare
  usage public.screen_time;
begin
  perform private.check_screen_time_day(p_profile, p_day);
  if not public.verify_account_password(p_password) then
    raise exception 'Your password is incorrect.' using errcode = 'P0001';
  end if;
  if p_minutes is null or p_minutes not between 15 and 120 then
    raise exception 'Add between 15 and 120 minutes.' using errcode = 'P0001';
  end if;
  insert into public.screen_time (user_id, profile_id, day, extra_seconds) values (auth.uid(), p_profile, p_day, p_minutes * 60)
  on conflict (profile_id, day) do update
    set extra_seconds = least(86400, public.screen_time.extra_seconds + excluded.extra_seconds), updated_at = now()
  returning * into usage;
  return usage;
end;
$$;
revoke execute on function public.add_extra_screen_time(uuid, date, integer, text) from public, anon;
grant execute on function public.add_extra_screen_time(uuid, date, integer, text) to authenticated;

-- Only today matters: rows older than a week are deleted nightly
create function private.delete_old_screen_time()
returns integer
language sql
security definer
set search_path = ''
as $$
  with gone as (delete from public.screen_time where day < current_date - 7 returning 1)
  select count(*)::integer from gone;
$$;
revoke execute on function private.delete_old_screen_time() from public, anon, authenticated;

select cron.schedule('delete-old-screen-time', '53 3 * * *', 'select private.delete_old_screen_time()');
