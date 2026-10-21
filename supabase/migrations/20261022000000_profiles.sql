-- Profiles: up to five per account, each with its own name, avatar and maturity rating, and its own watch list,
-- favorites, reminders, Continue Watching and game scores. Ratings, reviews, tickets and settings stay per account.

-- 1. The profiles. (id, user_id) is unique so child rows can reference both, which makes a row's profile always belong
--    to the row's own account (no policy can be fooled into pointing at someone else's profile).
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.netflix_tables (id) on delete cascade,
  name varchar not null check (char_length(btrim(name)) between 1 and 30),
  avatar varchar not null default 'blue' check (avatar in ('blue', 'red', 'yellow', 'green', 'purple')),
  maturity_rating varchar not null default 'all' check (maturity_rating in ('all', 'teen', 'kids')),
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, name)
);
grant select, insert, update, delete on public.profiles to authenticated;
alter table public.profiles enable row level security;
create policy "Users read their own rows" on public.profiles
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users add their own rows" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update their own rows" on public.profiles
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete their own rows" on public.profiles
  for delete to authenticated using ((select auth.uid()) = user_id);

-- At most five profiles, and never fewer than one while the account exists (deleting the account removes them all:
-- by then its netflix_tables row is gone, so the check lets the cascade through)
create function private.check_profile_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(hashtext(new.user_id::text));
    if (select count(*) from public.profiles where user_id = new.user_id) >= 5 then
      raise exception 'An account can have at most 5 profiles.' using errcode = 'P0001';
    end if;
    return new;
  end if;
  if exists (select 1 from public.netflix_tables where id = old.user_id)
    and (select count(*) from public.profiles where user_id = old.user_id) <= 1 then
    raise exception 'An account needs at least one profile.' using errcode = 'P0001';
  end if;
  return old;
end;
$$;
revoke execute on function private.check_profile_count() from public, anon, authenticated;
create trigger check_profile_count
  before insert or delete on public.profiles
  for each row execute function private.check_profile_count();

-- 2. Every account starts with one profile named after the member, with the maturity rating they had chosen
insert into public.profiles (user_id, name, maturity_rating)
select n.id, coalesce(nullif(left(btrim(n.name), 30), ''), 'Me'),
  case when p.maturity_rating in ('teen', 'kids') then p.maturity_rating else 'all' end
from public.netflix_tables n
left join public.preferences p on p.user_id = n.id;

create function private.create_first_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, name) values (new.id, coalesce(nullif(left(btrim(new.name), 30), ''), 'Me'));
  return new;
end;
$$;
revoke execute on function private.create_first_profile() from public, anon, authenticated;
create trigger on_account_created
  after insert on public.netflix_tables
  for each row execute function private.create_first_profile();

-- 3. Per-profile tables gain profile_id. Existing rows move to their account's first profile; a row added without one
--    (older app versions, the demo-account function, seeds) also goes to the first profile.
create function private.default_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.profile_id is null then
    new.profile_id := (select id from public.profiles where user_id = new.user_id order by created_at, id limit 1);
  end if;
  return new;
end;
$$;
revoke execute on function private.default_profile() from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['watch_list_tables', 'favorites', 'reminders', 'watch_progress', 'game_scores']
  loop
    execute format('alter table public.%I add column profile_id uuid', t);
    execute format($q$update public.%I x set profile_id = (select id from public.profiles p where p.user_id = x.user_id
      order by p.created_at, p.id limit 1)$q$, t);
    execute format('alter table public.%I alter column profile_id set not null', t);
    execute format('alter table public.%I add constraint %I foreign key (profile_id, user_id)
      references public.profiles (id, user_id) on delete cascade', t, t || '_profile_fkey');
    execute format('create trigger default_profile before insert on public.%I
      for each row execute function private.default_profile()', t);
  end loop;
end;
$$;

-- One row per profile instead of per account (the new unique constraints lead with profile_id, so they also index the
-- foreign keys)
alter table public.watch_list_tables drop constraint watch_list_tables_user_id_title_id_key;
alter table public.watch_list_tables add constraint watch_list_tables_profile_id_title_id_key unique (profile_id, title_id);
alter table public.favorites drop constraint favorites_user_id_title_id_key;
alter table public.favorites add constraint favorites_profile_id_title_id_key unique (profile_id, title_id);
alter table public.reminders drop constraint reminders_user_id_title_id_key;
alter table public.reminders add constraint reminders_profile_id_title_id_key unique (profile_id, title_id);
alter table public.watch_progress drop constraint watch_progress_user_id_title_id_key;
alter table public.watch_progress add constraint watch_progress_profile_id_title_id_key unique (profile_id, title_id);
alter table public.game_scores drop constraint game_scores_user_id_game_key;
alter table public.game_scores add constraint game_scores_profile_id_game_key unique (profile_id, game);

-- 4. The maturity rating now lives on each profile; preferences.maturity_rating is no longer read by the app
comment on column public.preferences.maturity_rating is 'Superseded by profiles.maturity_rating (copied there on 2026-10-22)';

-- 5. Leaderboards list profiles (by profile name) of members who opted in; p_profile marks the caller's own row
drop function public.game_leaderboard(varchar);
create function public.game_leaderboard(p_game varchar, p_profile uuid default null)
returns table (place integer, player varchar, best_score integer, is_me boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (row_number() over (order by
      case when p_game = 'memory' then s.best_score end asc,
      case when p_game <> 'memory' then s.best_score end desc,
      s.updated_at asc))::integer,
    coalesce(nullif(split_part(btrim(pr.name), ' ', 1), ''), 'Member')::varchar,
    s.best_score,
    coalesce(s.user_id = (select auth.uid()) and s.profile_id = p_profile, false)
  from public.game_scores s
  join public.profiles pr on pr.id = s.profile_id
  join public.preferences p on p.user_id = s.user_id and p.show_on_leaderboards
  join public.netflix_tables a on a.id = s.user_id and a.access_removed_at is null
  where s.game = p_game and s.best_score is not null
  order by 1
  limit 10;
$$;
revoke execute on function public.game_leaderboard(varchar, uuid) from public;
grant execute on function public.game_leaderboard(varchar, uuid) to anon, authenticated;
