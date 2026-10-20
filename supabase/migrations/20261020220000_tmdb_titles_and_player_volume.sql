-- TMDB titles members can save to My List and Favorites, and each member's video player volume.

-- 1. titles holds the catalog plus the TMDB titles members have saved; `source` tells them apart. Watch lists,
--    favorites, reviews and reminders keep their foreign key to titles, so a saved TMDB title works like any other.
--    Only the tmdb Edge Function (secret key) adds TMDB rows, from TMDB's own data; the app's catalog reads
--    source = 'catalog'.
alter table public.titles
  add column source varchar not null default 'catalog' check (source in ('catalog', 'tmdb'));

-- 2. The TMDB-only details of each saved TMDB title (one row per title). Readable by anyone, like the catalog;
--    written only by the tmdb Edge Function. title_id is the primary key, so the foreign key is indexed.
create table public.tmdb_titles (
  title_id varchar primary key references public.titles (id) on delete cascade, -- e.g. 'tmdb-movie-603'
  tmdb_id integer not null,
  media_type varchar not null check (media_type in ('movie', 'tv')),
  backdrop_url varchar,
  tmdb_rating numeric(3, 1) check (tmdb_rating between 0 and 10),
  tmdb_url varchar not null,
  fetched_at timestamptz not null default now(),
  unique (media_type, tmdb_id)
);
grant select on public.tmdb_titles to anon, authenticated;
alter table public.tmdb_titles enable row level security;
create policy "Anyone can read saved TMDB titles" on public.tmdb_titles
  for select to anon, authenticated using (true);

-- 3. The video player's volume (0-100), so it follows the member to any device; null means full volume. Members
--    already read and update their own preferences row (owner-only policies), which covers the new column.
alter table public.preferences
  add column player_volume smallint check (player_volume between 0 and 100);
