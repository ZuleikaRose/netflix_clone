-- Two-step sign-in (Supabase Auth MFA, TOTP) and the account's signed-in devices.
--
-- 1. A member who has turned on two-step sign-in has a verified factor in auth.mfa_factors. Until they enter a code,
--    their session is aal1; public.second_step_done() is false for it, and a restrictive policy on every public table
--    with RLS keeps that session away from all data, so a stolen password alone reads nothing. Members without a
--    factor (and signed-out visitors) aren't affected. The Edge Functions check the same thing (_shared/supabase.ts).
-- 2. public.my_sessions() lists the member's signed-in devices and public.end_session() signs one of them out.

create function public.second_step_done()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    or not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified');
$$;
revoke execute on function public.second_step_done() from public;
grant execute on function public.second_step_done() to anon, authenticated;

do $$
declare
  t text;
begin
  for t in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
    order by c.relname
  loop
    execute format(
      'create policy "Two-step sign-in finished" on public.%I as restrictive for all to authenticated
        using ((select public.second_step_done())) with check ((select public.second_step_done()))', t);
  end loop;
end;
$$;

-- The member's signed-in devices, most recently active first. `current` is the session making the request.
-- Empty until the second step is done.
create function public.my_sessions()
returns table (id uuid, user_agent text, signed_in_at timestamptz, last_active_at timestamptz, current boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.user_agent, s.created_at,
    greatest(s.created_at, s.updated_at, s.refreshed_at at time zone 'UTC'),
    s.id::text = auth.jwt() ->> 'session_id'
  from auth.sessions s
  where s.user_id = auth.uid() and (s.not_after is null or s.not_after > now()) and public.second_step_done()
  order by 4 desc;
$$;
revoke execute on function public.my_sessions() from public, anon;
grant execute on function public.my_sessions() to authenticated;

-- Signs out one of the member's other devices: its refresh tokens go with the session, so it can't renew its sign-in
-- (an access token it already has stays valid until it expires, within the hour). True if a session was removed.
create function public.end_session(p_session uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.second_step_done() then
    return false;
  end if;
  delete from auth.sessions s
  where s.id = p_session and s.user_id = auth.uid() and s.id::text is distinct from auth.jwt() ->> 'session_id';
  return found;
end;
$$;
revoke execute on function public.end_session(uuid) from public, anon;
grant execute on function public.end_session(uuid) to authenticated;
