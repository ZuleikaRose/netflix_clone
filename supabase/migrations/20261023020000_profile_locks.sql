-- Profile locks: a four-digit PIN on any profile, asked for before it opens on Who's watching. Setting or removing a
-- PIN needs the account password, which public.verify_account_password() also checks for Kids profiles ("Ask a
-- grown-up") and Change password. PINs are stored as bcrypt hashes in the private schema, which the API can't reach;
-- profiles.locked says which profiles have one, and only these functions change it.

create extension if not exists pgcrypto with schema extensions;

create table private.profile_pins (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  pin_hash text not null,
  -- Wrong PINs since the last right one; five in a row lock the profile for 15 minutes
  failed_attempts integer not null default 0,
  locked_until timestamptz
);

alter table public.profiles add column locked boolean not null default false;

-- Members can't set or clear `locked` themselves (a Kids profile could otherwise unlock another): writes outside the
-- functions below keep the old value
create function private.guard_profile_lock()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_setting('app.profile_pin', true) is distinct from 'on' then
    new.locked := case when tg_op = 'INSERT' then false else old.locked end;
  end if;
  return new;
end;
$$;
revoke execute on function private.guard_profile_lock() from public, anon, authenticated;
create trigger guard_profile_lock before insert or update on public.profiles
  for each row execute function private.guard_profile_lock();

-- True when p_password is the signed-in member's password. Ten checks per 15 minutes per account, so a password
-- can't be guessed through it.
create function public.verify_account_password(p_password text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  matches boolean;
begin
  if auth.uid() is null then
    return false;
  end if;
  if not public.hit_rate_limit('password:' || auth.uid(), 10, 900) then
    raise exception 'Too many tries. Please wait a few minutes and try again.' using errcode = 'P0001';
  end if;
  select u.encrypted_password <> '' and extensions.crypt(p_password, u.encrypted_password) = u.encrypted_password
    into matches from auth.users u where u.id = auth.uid();
  return coalesce(matches, false);
end;
$$;
revoke execute on function public.verify_account_password(text) from public, anon;
grant execute on function public.verify_account_password(text) to authenticated;

-- Sets (four digits) or removes (null) a profile's PIN, after checking the account password
create function public.set_profile_pin(p_profile uuid, p_pin text, p_password text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles where id = p_profile and user_id = auth.uid()) then
    raise exception 'Profile not found.' using errcode = 'P0001';
  end if;
  if not public.verify_account_password(p_password) then
    raise exception 'Your password is incorrect.' using errcode = 'P0001';
  end if;
  if p_pin is not null and p_pin !~ '^[0-9]{4}$' then
    raise exception 'A PIN is four digits.' using errcode = 'P0001';
  end if;

  if p_pin is null then
    delete from private.profile_pins where profile_id = p_profile;
  else
    insert into private.profile_pins (profile_id, pin_hash)
    values (p_profile, extensions.crypt(p_pin, extensions.gen_salt('bf', 8)))
    on conflict (profile_id) do update set pin_hash = excluded.pin_hash, failed_attempts = 0, locked_until = null;
  end if;
  perform set_config('app.profile_pin', 'on', true);
  update public.profiles set locked = p_pin is not null where id = p_profile;
  perform set_config('app.profile_pin', 'off', true);
end;
$$;
revoke execute on function public.set_profile_pin(uuid, text, text) from public, anon;
grant execute on function public.set_profile_pin(uuid, text, text) to authenticated;

-- Checks a PIN: 'ok' (right, or the profile has no PIN), 'wrong', or 'locked' (five wrong PINs in a row: wait 15
-- minutes). A result instead of an error, so the count of wrong tries is saved.
create function public.unlock_profile(p_profile uuid, p_pin text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  pin private.profile_pins;
begin
  select pp.* into pin from private.profile_pins pp
  join public.profiles p on p.id = pp.profile_id
  where pp.profile_id = p_profile and p.user_id = auth.uid()
  for update of pp;
  if not found then
    return case when exists (select 1 from public.profiles where id = p_profile and user_id = auth.uid()) then 'ok' else 'wrong' end;
  end if;
  if pin.locked_until > now() then
    return 'locked';
  end if;
  if extensions.crypt(coalesce(p_pin, ''), pin.pin_hash) = pin.pin_hash then
    update private.profile_pins set failed_attempts = 0, locked_until = null where profile_id = p_profile;
    return 'ok';
  end if;
  if pin.failed_attempts + 1 >= 5 then
    update private.profile_pins set failed_attempts = 0, locked_until = now() + interval '15 minutes' where profile_id = p_profile;
    return 'locked';
  end if;
  update private.profile_pins set failed_attempts = pin.failed_attempts + 1, locked_until = null where profile_id = p_profile;
  return 'wrong';
end;
$$;
revoke execute on function public.unlock_profile(uuid, text) from public, anon;
grant execute on function public.unlock_profile(uuid, text) to authenticated;
