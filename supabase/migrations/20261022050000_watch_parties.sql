-- Watch parties: members watch a catalog title together. Play, pause, seeking, who's there and the chat travel over
-- a private Realtime channel, party:<code>; only the party's members may use it (RLS on realtime.messages below).
-- A party lasts six hours; old ones are deleted nightly.

create table public.watch_parties (
  id uuid primary key default gen_random_uuid(),
  -- 40 random bits, so invite links can't be guessed in practice; the host shares the link
  code varchar not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 10),
  host_id uuid not null default auth.uid() references public.netflix_tables (id) on delete cascade,
  title_id varchar not null references public.titles (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '6 hours'
);

create table public.watch_party_members (
  party_id uuid not null references public.watch_parties (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.netflix_tables (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (party_id, user_id)
);

grant select, insert on public.watch_parties to authenticated;
grant select, delete on public.watch_party_members to authenticated;
alter table public.watch_parties enable row level security;
alter table public.watch_party_members enable row level security;

create policy "Members read their own memberships" on public.watch_party_members
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Members leave parties" on public.watch_party_members
  for delete to authenticated using ((select auth.uid()) = user_id);
-- The host directly too: insert … returning reads the new row before the host's membership exists
create policy "Members read their parties" on public.watch_parties
  for select to authenticated using (
    (select auth.uid()) = host_id
    or exists (select 1 from public.watch_party_members m where m.party_id = watch_parties.id and m.user_id = (select auth.uid()))
  );
create policy "Members host parties" on public.watch_parties
  for insert to authenticated with check ((select auth.uid()) = host_id);

-- The host is the first member
create function private.add_party_host()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.watch_party_members (party_id, user_id) values (new.id, new.host_id);
  return null;
end;
$$;
revoke execute on function private.add_party_host() from public, anon, authenticated;
create trigger add_party_host after insert on public.watch_parties
  for each row execute function private.add_party_host();

-- Joining by invite code: adds the caller as a member and returns { id, code, titleId, host }. A missing or
-- expired party raises P0002.
create function public.join_watch_party(p_code varchar)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  party public.watch_parties;
begin
  select * into party from public.watch_parties where code = p_code and expires_at > now();
  if party.id is null then
    raise exception 'This watch party has ended or doesn''t exist.' using errcode = 'P0002';
  end if;
  insert into public.watch_party_members (party_id, user_id) values (party.id, (select auth.uid()))
    on conflict do nothing;
  return jsonb_build_object(
    'id', party.id,
    'code', party.code,
    'titleId', party.title_id,
    'host', (select name from public.netflix_tables where id = party.host_id),
    'expiresAt', party.expires_at
  );
end;
$$;
revoke execute on function public.join_watch_party(varchar) from public, anon;
grant execute on function public.join_watch_party(varchar) to authenticated;

-- Realtime: only members of a live party can join its private channel, send on it and share presence
create policy "Party members receive on their party's channel" on realtime.messages
  for select to authenticated using (
    realtime.messages.extension in ('broadcast', 'presence')
    and exists (
      select 1 from public.watch_party_members m
      join public.watch_parties p on p.id = m.party_id
      where m.user_id = (select auth.uid()) and 'party:' || p.code = (select realtime.topic()) and p.expires_at > now()
    )
  );
create policy "Party members send on their party's channel" on realtime.messages
  for insert to authenticated with check (
    realtime.messages.extension in ('broadcast', 'presence')
    and exists (
      select 1 from public.watch_party_members m
      join public.watch_parties p on p.id = m.party_id
      where m.user_id = (select auth.uid()) and 'party:' || p.code = (select realtime.topic()) and p.expires_at > now()
    )
  );

-- New and empty, so built here: memberships by member (account deletion, the policies above) and parties by host
-- and title (their foreign keys)
create index watch_party_members_user_id_idx on public.watch_party_members (user_id);
create index watch_parties_host_id_idx on public.watch_parties (host_id);
create index watch_parties_title_id_idx on public.watch_parties (title_id);

-- Parties that ended more than a day ago
create function private.delete_old_watch_parties()
returns integer
language sql
security definer
set search_path = ''
as $$
  with gone as (delete from public.watch_parties where expires_at < now() - interval '1 day' returning 1)
  select count(*)::integer from gone;
$$;
revoke execute on function private.delete_old_watch_parties() from public, anon, authenticated;
select cron.schedule('delete-old-watch-parties', '37 3 * * *', 'select private.delete_old_watch_parties()');
