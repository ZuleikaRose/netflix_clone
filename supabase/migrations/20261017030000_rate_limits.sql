-- Per-IP rate limits for the public Edge Functions (demo-account creates accounts, record-referral counts clicks).
-- Only the functions' secret key can use these: no anon/authenticated grants, RLS on with no policies. The lookup
-- index is in non_transactional/003_rate_limit_index.sql (CREATE INDEX CONCURRENTLY).

create table public.rate_limit_hits (
  id bigint generated always as identity primary key,
  key varchar not null, -- e.g. 'demo-account:203.0.113.7'
  hit_at timestamptz not null default now()
);
revoke all on public.rate_limit_hits from anon, authenticated;
grant select, insert on public.rate_limit_hits to service_role;
alter table public.rate_limit_hits enable row level security;

-- Records a hit for `key` and returns true, or returns false (recording nothing) once `max_hits` hits fall inside
-- the last `window_seconds`. The advisory lock makes concurrent requests for the same key take turns, so a burst
-- can't all pass the count before any of them is recorded.
create function public.hit_rate_limit(key text, max_hits integer, window_seconds integer)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  recent integer;
begin
  perform pg_advisory_xact_lock(hashtext('rate_limit:' || key));
  select count(*) into recent from public.rate_limit_hits h
  where h.key = hit_rate_limit.key and h.hit_at > now() - make_interval(secs => window_seconds);
  if recent >= max_hits then
    return false;
  end if;
  insert into public.rate_limit_hits (key) values (hit_rate_limit.key);
  return true;
end;
$$;

revoke execute on function public.hit_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, integer, integer) to service_role;

-- Hits older than a day are no longer needed by any limit
create function private.delete_old_rate_limit_hits()
returns integer
language sql
security definer
set search_path = ''
as $$
  with gone as (
    delete from public.rate_limit_hits where hit_at < now() - interval '1 day' returning 1
  )
  select count(*)::integer from gone;
$$;

revoke execute on function private.delete_old_rate_limit_hits() from public, anon, authenticated;

select cron.schedule('delete-old-rate-limit-hits', '41 * * * *', 'select private.delete_old_rate_limit_hits()');
