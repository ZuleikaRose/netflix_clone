-- Year in Review: one profile's viewing history for a year, summed up for the page (data/yearInReview.js does the rest):
--   { years: [years with history, newest first], days: ['YYYY-MM-DD', …], months: [12 counts of viewings],
--     titles: [{ titleId, viewings, episodes: [episode numbers] }] }
-- Runs as the caller, so viewing_history's policies keep it to the member's own profiles (another profile id just
-- finds nothing).

create function public.year_in_review(p_profile uuid, p_year integer)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with history as (
    select title_id, episode, watched_on from public.viewing_history where profile_id = p_profile
  ), year as (
    select * from history where watched_on >= make_date(p_year, 1, 1) and watched_on < make_date(p_year + 1, 1, 1)
  )
  select jsonb_build_object(
    'years', (select coalesce(jsonb_agg(y order by y desc), '[]'::jsonb)
      from (select distinct extract(year from watched_on)::integer as y from history) s),
    'days', (select coalesce(jsonb_agg(d order by d), '[]'::jsonb) from (select distinct watched_on as d from year) s),
    'months', (select jsonb_agg(coalesce(c.n, 0) order by m)
      from generate_series(1, 12) m
      left join (select extract(month from watched_on)::integer as month, count(*) as n from year group by 1) c on c.month = m),
    'titles', (select coalesce(jsonb_agg(jsonb_build_object('titleId', title_id, 'viewings', n, 'episodes', to_jsonb(episodes))
        order by title_id), '[]'::jsonb)
      from (select title_id, count(*) as n, coalesce(array_agg(distinct episode) filter (where episode > 0), '{}') as episodes
        from year group by title_id) t)
  );
$$;
revoke execute on function public.year_in_review(uuid, integer) from public, anon;
grant execute on function public.year_in_review(uuid, integer) to authenticated;
