-- Continue Watching saved per member, TMDB trailers and certifications, and opt-in game leaderboards.

-- 1. Where each member stopped in each title (one row per member and title), so Continue Watching follows them to
--    any device. Owner-only, like watch lists. A title watched to the end has its row removed. The title_id index is
--    in non_transactional/004_watch_progress_index.sql (CONCURRENTLY).
create table public.watch_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.netflix_tables (id) on delete cascade,
  title_id varchar not null references public.titles (id) on delete cascade,
  episode smallint not null default 1 check (episode >= 1), -- shows only; movies stay at 1
  position_seconds numeric(8, 1) not null default 0 check (position_seconds >= 0),
  progress_percent smallint not null check (progress_percent between 0 and 100),
  updated_at timestamptz not null default now(),
  unique (user_id, title_id)
);
grant select, insert, update, delete on public.watch_progress to authenticated;
alter table public.watch_progress enable row level security;
create policy "Users read their own rows" on public.watch_progress
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users add their own rows" on public.watch_progress
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update their own rows" on public.watch_progress
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete their own rows" on public.watch_progress
  for delete to authenticated using ((select auth.uid()) = user_id);

-- 2. A saved TMDB title's YouTube trailer (the video key), written by the tmdb Edge Function with the rest of the row.
alter table public.tmdb_titles add column trailer_youtube_key varchar;

-- 3. US certifications (PG-13, TV-MA…) of the TMDB titles the app lists, so restricted profiles can see the ones
--    within their maturity setting. TMDB's lists don't include them, so the tmdb function looks each title up once and
--    keeps the answer here ('NR' when TMDB has none). Only the function uses it: no grants, RLS with no policies.
create table public.tmdb_certifications (
  media_type varchar not null check (media_type in ('movie', 'tv')),
  tmdb_id integer not null,
  certification varchar not null,
  fetched_at timestamptz not null default now(),
  primary key (media_type, tmdb_id)
);
alter table public.tmdb_certifications enable row level security;

-- 4. Game leaderboards are opt-in: a member's first name and best scores show only after they turn this on.
alter table public.preferences
  add column show_on_leaderboards boolean not null default false;

-- 5. When a best score was set, so ties go to whoever got there first.
alter table public.game_scores
  add column updated_at timestamptz not null default now();

-- 6. The top ten of a game among members who opted in: place, first name (never the email or id) and best score.
--    Poster Match ('memory') counts moves, so fewer is better; every other game counts points. is_me marks the
--    caller's own row. security definer because game_scores and preferences are owner-only.
create function public.game_leaderboard(p_game varchar)
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
    coalesce(nullif(split_part(btrim(a.name), ' ', 1), ''), 'Member')::varchar,
    s.best_score,
    s.user_id = (select auth.uid())
  from public.game_scores s
  join public.preferences p on p.user_id = s.user_id and p.show_on_leaderboards
  join public.netflix_tables a on a.id = s.user_id and a.access_removed_at is null
  where s.game = p_game and s.best_score is not null
  order by 1
  limit 10;
$$;
revoke execute on function public.game_leaderboard(varchar) from public;
grant execute on function public.game_leaderboard(varchar) to anon, authenticated;
