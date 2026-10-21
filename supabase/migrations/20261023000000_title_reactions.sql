-- Thumbs ratings: a profile's quick reaction to a title ('dislike' = Not for me, 'like' = I like this, 'love' = Love
-- this!). Loved and liked titles seed Because You Liked; disliked ones are left out of recommendations. One per profile
-- and title; removing the reaction deletes the row. Separate from the account's star ratings in public.review.

create table public.title_reactions (
  user_id uuid not null default auth.uid() references public.netflix_tables (id) on delete cascade,
  profile_id uuid not null,
  title_id varchar not null references public.titles (id) on delete cascade,
  reaction varchar not null check (reaction in ('dislike', 'like', 'love')),
  updated_at timestamptz not null default now(),
  primary key (profile_id, title_id),
  foreign key (profile_id, user_id) references public.profiles (id, user_id) on delete cascade
);

grant select, insert, update, delete on public.title_reactions to authenticated;
alter table public.title_reactions enable row level security;

create policy "Users read their own rows" on public.title_reactions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users add their own rows" on public.title_reactions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update their own rows" on public.title_reactions
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete their own rows" on public.title_reactions
  for delete to authenticated using ((select auth.uid()) = user_id);

create trigger default_profile before insert on public.title_reactions
  for each row execute function private.default_profile();

-- Its foreign-key indexes are in non_transactional/008_title_reactions_indexes.sql (CONCURRENTLY)
