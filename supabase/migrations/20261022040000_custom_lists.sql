-- Custom lists: a profile's own named lists of titles ("Friday horror", "Watch with Mum"). A list is private until
-- its owner makes it public; then anyone with its link can see it through public.shared_list(slug), which returns
-- only the list's name, description, the profile's name and its titles, never account ids.

create table public.custom_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.netflix_tables (id) on delete cascade,
  profile_id uuid not null,
  name varchar not null check (char_length(btrim(name)) between 1 and 60),
  description varchar check (char_length(description) <= 280),
  is_public boolean not null default false,
  -- 64 random bits: share links can't be guessed or listed
  share_slug varchar not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 16),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (profile_id, user_id) references public.profiles (id, user_id) on delete cascade,
  unique (profile_id, name)
);

create table public.custom_list_items (
  list_id uuid not null references public.custom_lists (id) on delete cascade,
  title_id varchar not null references public.titles (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.netflix_tables (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (list_id, title_id)
);

grant select, insert, update, delete on public.custom_lists, public.custom_list_items to authenticated;
alter table public.custom_lists enable row level security;
alter table public.custom_list_items enable row level security;

create policy "Users read their own rows" on public.custom_lists
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users add their own rows" on public.custom_lists
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update their own rows" on public.custom_lists
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete their own rows" on public.custom_lists
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Items go only into the member's own lists
create policy "Users read their own rows" on public.custom_list_items
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users add to their own lists" on public.custom_list_items
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.custom_lists l where l.id = list_id and l.user_id = (select auth.uid()))
  );
create policy "Users delete their own rows" on public.custom_list_items
  for delete to authenticated using ((select auth.uid()) = user_id);

create trigger default_profile before insert on public.custom_lists
  for each row execute function private.default_profile();

-- A list's updated_at moves when it's renamed or its titles change (shared pages show it)
create function private.touch_custom_list()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'custom_lists' then
    new.updated_at := now();
    return new;
  end if;
  -- Items removed by a cascade (the list or the account is being deleted) have no list left to touch
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return null;
  end if;
  update public.custom_lists set updated_at = now() where id = coalesce(new.list_id, old.list_id);
  return null;
end;
$$;
revoke execute on function private.touch_custom_list() from public, anon, authenticated;
create trigger touch_custom_list before update on public.custom_lists
  for each row execute function private.touch_custom_list();
create trigger touch_custom_list after insert or delete on public.custom_list_items
  for each row execute function private.touch_custom_list();

-- A public list by its share slug: { name, description, owner, updatedAt, titleIds } (oldest first), or null when
-- there's no such public list. security definer because lists are owner-only.
create function public.shared_list(p_slug varchar)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'name', l.name,
    'description', l.description,
    'owner', p.name,
    'updatedAt', l.updated_at,
    'titleIds', coalesce((select jsonb_agg(i.title_id order by i.added_at, i.title_id)
      from public.custom_list_items i where i.list_id = l.id), '[]'::jsonb)
  )
  from public.custom_lists l
  join public.profiles p on p.id = l.profile_id
  where l.share_slug = p_slug and l.is_public;
$$;
revoke execute on function public.shared_list(varchar) from public;
grant execute on function public.shared_list(varchar) to anon, authenticated;

-- New and empty, so built here. A profile's lists by account (covers the user_id and profile keys' lookups);
-- items by member (account deletion) and by title (catalog changes).
create index custom_lists_user_id_profile_id_idx on public.custom_lists (user_id, profile_id);
create index custom_list_items_user_id_idx on public.custom_list_items (user_id);
create index custom_list_items_title_id_idx on public.custom_list_items (title_id);
