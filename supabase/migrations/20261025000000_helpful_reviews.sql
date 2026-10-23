-- "Helpful" votes on reviews: a member marks another member's review helpful (once; tapping again takes the vote
-- back), and title pages sort reviews by most helpful or newest. review.helpful_count is kept by triggers on
-- review_helpful_votes, so pages read the count with the review and nobody can set it directly. Members read only
-- their own votes.

alter table public.review add column helpful_count integer not null default 0 check (helpful_count >= 0);

-- Like profiles.locked (migration ..._profile_locks): only the vote triggers change the count, so an author can't
-- raise their own review's
create function private.guard_helpful_count()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_setting('app.helpful_count', true) is distinct from 'on' then
    new.helpful_count := case when tg_op = 'INSERT' then 0 else old.helpful_count end;
  end if;
  return new;
end;
$$;
revoke execute on function private.guard_helpful_count() from public, anon, authenticated;
create trigger guard_helpful_count before insert or update on public.review
  for each row execute function private.guard_helpful_count();

create table public.review_helpful_votes (
  review_id uuid not null references public.review (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.netflix_tables (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (review_id, user_id)
);

grant select, delete on public.review_helpful_votes to authenticated;
grant insert (review_id) on public.review_helpful_votes to authenticated;
alter table public.review_helpful_votes enable row level security;
create policy "Users read their own rows" on public.review_helpful_votes
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users add their own rows" on public.review_helpful_votes
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users delete their own rows" on public.review_helpful_votes
  for delete to authenticated using ((select auth.uid()) = user_id);
create policy "Two-step sign-in finished" on public.review_helpful_votes as restrictive for all to authenticated
  using ((select public.second_step_done())) with check ((select public.second_step_done()));

-- Refuses a vote on a review that has no text (a rating alone) or is the member's own
create function private.check_helpful_vote()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  voted public.review;
begin
  select * into voted from public.review where id = new.review_id;
  if not found or voted.body is null then
    raise exception 'That review no longer exists.' using errcode = 'P0001';
  end if;
  if voted.user_id = auth.uid() then
    raise exception 'You can''t mark your own review helpful.' using errcode = 'P0001';
  end if;
  new.user_id := auth.uid();
  new.created_at := now();
  return new;
end;
$$;
revoke execute on function private.check_helpful_vote() from public, anon, authenticated;
create trigger check_helpful_vote before insert on public.review_helpful_votes
  for each row execute function private.check_helpful_vote();

-- Keeps review.helpful_count in step with the votes
create function private.count_helpful_vote()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('app.helpful_count', 'on', true);
  if tg_op = 'INSERT' then
    update public.review set helpful_count = helpful_count + 1 where id = new.review_id;
  else
    update public.review set helpful_count = greatest(helpful_count - 1, 0) where id = old.review_id;
  end if;
  perform set_config('app.helpful_count', 'off', true);
  return null;
end;
$$;
revoke execute on function private.count_helpful_vote() from public, anon, authenticated;
create trigger count_helpful_vote after insert or delete on public.review_helpful_votes
  for each row execute function private.count_helpful_vote();
