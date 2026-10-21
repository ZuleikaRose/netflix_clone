-- Viewing history (Account → Viewing activity): one row per title (and episode) per day a profile watched it, plus
-- the member's privacy choices: pause the history, and have old entries deleted automatically.

-- 1. The member's choices (account-wide, like the other preferences)
alter table public.preferences
  add column keep_viewing_history boolean not null default true,
  add column history_retention_days smallint check (history_retention_days in (90, 365));

-- 2. The history. episode is 0 for movies; watched_on is the viewer's own day, sent by the app.
create table public.viewing_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.netflix_tables (id) on delete cascade,
  profile_id uuid not null,
  title_id varchar not null references public.titles (id) on delete cascade,
  episode smallint not null default 0 check (episode >= 0),
  watched_on date not null default current_date,
  watched_at timestamptz not null default now(),
  foreign key (profile_id, user_id) references public.profiles (id, user_id) on delete cascade,
  unique (profile_id, title_id, episode, watched_on)
);
grant select, insert, update, delete on public.viewing_history to authenticated;
alter table public.viewing_history enable row level security;
create policy "Users read their own rows" on public.viewing_history
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users add their own rows" on public.viewing_history
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update their own rows" on public.viewing_history
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete their own rows" on public.viewing_history
  for delete to authenticated using ((select auth.uid()) = user_id);

create trigger default_profile before insert on public.viewing_history
  for each row execute function private.default_profile();

-- A paused history records nothing, whatever the app sends
create function private.skip_paused_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.preferences where user_id = new.user_id and not keep_viewing_history) then
    return null;
  end if;
  return new;
end;
$$;
revoke execute on function private.skip_paused_history() from public, anon, authenticated;
create trigger skip_paused_history before insert on public.viewing_history
  for each row execute function private.skip_paused_history();

-- The table starts empty, so these are built in the migration (no CONCURRENTLY needed)
-- A profile's history, newest first (also covers the user_id and profile foreign keys' lookups by account)
create index viewing_history_user_id_profile_id_watched_at_idx on public.viewing_history (user_id, profile_id, watched_at desc);
-- Removing a title from the catalog
create index viewing_history_title_id_idx on public.viewing_history (title_id);

-- 3. Entries older than the member's chosen limit go every night
create function private.delete_old_viewing_history()
returns integer
language sql
security definer
set search_path = ''
as $$
  with gone as (
    delete from public.viewing_history h
    using public.preferences p
    where p.user_id = h.user_id
      and p.history_retention_days is not null
      and h.watched_at < now() - make_interval(days => p.history_retention_days)
    returning 1
  )
  select count(*)::integer from gone;
$$;
revoke execute on function private.delete_old_viewing_history() from public, anon, authenticated;

select cron.schedule('delete-old-viewing-history', '23 3 * * *', 'select private.delete_old_viewing_history()');
