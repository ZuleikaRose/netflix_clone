-- Better search: typo-tolerant title search with pg_trgm, and each profile's recent searches.

create extension if not exists pg_trgm with schema extensions;

-- 1. Catalog titles whose name or cast is close to the query ("nite shift" → Night Shift), best first, with a score
--    0–1. Word similarity compares the query with the closest stretch of the text, so short queries still match long
--    titles. Titles are public, so this runs as the caller (anon included) under the titles policies.
create function public.search_titles(p_query varchar, p_limit integer default 12)
returns table (id varchar, score real)
language sql
stable
set search_path = ''
set pg_trgm.word_similarity_threshold = 0.4
as $$
  with q as (select lower(btrim(p_query)) as text)
  select t.id, greatest(
      extensions.word_similarity(q.text, lower(t.title)),
      coalesce((select max(extensions.word_similarity(q.text, lower(c))) from unnest(t.cast_members) c), 0)
    ) as score
  from public.titles t, q
  where t.source = 'catalog' and char_length(q.text) between 2 and 100
    and (q.text operator(extensions.<%) lower(t.title)
      or exists (select 1 from unnest(t.cast_members) c where q.text operator(extensions.<%) lower(c)))
  order by score desc, t.popularity desc
  limit least(greatest(p_limit, 1), 50);
$$;
revoke execute on function public.search_titles(varchar, integer) from public;
grant execute on function public.search_titles(varchar, integer) to anon, authenticated;

-- 2. Recent searches: a profile's last ten, newest first. They're history too, so a paused history records none
--    (private.skip_paused_history checks the member's preference).
create table public.recent_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.netflix_tables (id) on delete cascade,
  profile_id uuid not null,
  query varchar not null check (char_length(btrim(query)) between 1 and 100),
  query_key varchar generated always as (lower(btrim(query))) stored,
  searched_at timestamptz not null default now(),
  foreign key (profile_id, user_id) references public.profiles (id, user_id) on delete cascade,
  unique (profile_id, query_key)
);
grant select, insert, update, delete on public.recent_searches to authenticated;
alter table public.recent_searches enable row level security;
create policy "Users read their own rows" on public.recent_searches
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users add their own rows" on public.recent_searches
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update their own rows" on public.recent_searches
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete their own rows" on public.recent_searches
  for delete to authenticated using ((select auth.uid()) = user_id);

create trigger default_profile before insert on public.recent_searches
  for each row execute function private.default_profile();
create trigger skip_paused_history before insert on public.recent_searches
  for each row execute function private.skip_paused_history();

-- Only the newest ten per profile are kept
create function private.trim_recent_searches()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.recent_searches
  where profile_id = new.profile_id
    and id not in (select id from public.recent_searches where profile_id = new.profile_id order by searched_at desc limit 10);
  return null;
end;
$$;
revoke execute on function private.trim_recent_searches() from public, anon, authenticated;
create trigger trim_recent_searches after insert or update on public.recent_searches
  for each row execute function private.trim_recent_searches();

-- New and empty, so built here: a profile's searches newest first (also the account and profile keys' lookups)
create index recent_searches_user_id_profile_id_searched_at_idx on public.recent_searches (user_id, profile_id, searched_at desc);
