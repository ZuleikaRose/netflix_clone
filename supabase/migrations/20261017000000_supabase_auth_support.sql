-- Support for signing in with Supabase Auth and saving each user's data.

-- 1. New tables in public are no longer reachable by anon/authenticated until a migration grants it -----------------
-- service_role keeps its defaults: Edge Functions use it and it bypasses RLS anyway.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;

-- 2. Account rows: sign-up defaults, preferences row, referral sign-ups; keep email and last sign-in in sync -------
-- Billing is simulated: new accounts get the same placeholder card the app has always shown.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  referral text := upper(nullif(new.raw_user_meta_data ->> 'referral_code', ''));
begin
  insert into public.netflix_tables (id, email, name, plan, billing_day, card_brand, card_last4, card_exp)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    case when new.raw_user_meta_data ->> 'plan' in ('basic', 'standard', 'premium')
      then new.raw_user_meta_data ->> 'plan' else 'standard' end,
    15, 'Visa', '4242', '08/28'
  );
  insert into public.preferences (user_id, autoplay_next, autoplay_previews, email_updates, personalized, maturity_rating)
  values (new.id, true, false, true, true, 'all');
  if referral is not null then
    insert into public.referrals (affiliate_id, kind)
    select a.id, 'signup' from public.affiliates a where a.referral_code = referral;
  end if;
  return new;
end;
$$;

create function private.sync_user_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.netflix_tables
  set email = lower(new.email), last_sign_in = new.last_sign_in_at
  where id = new.id
    and (email is distinct from lower(new.email) or last_sign_in is distinct from new.last_sign_in_at);
  return new;
end;
$$;

revoke execute on function private.sync_user_account() from public, anon, authenticated;

create trigger on_auth_user_updated
  after update of email, last_sign_in_at on auth.users
  for each row execute function private.sync_user_account();

-- 3. Reviews carry the author's display name, so anyone can read them without reading accounts -------------------
-- Set by a trigger on every write, so users can't post under someone else's name.
alter table public.review add column author_name varchar not null default '';

create function private.set_review_author()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.author_name := coalesce((select n.name from public.netflix_tables n where n.id = new.user_id), '');
  return new;
end;
$$;

revoke execute on function private.set_review_author() from public, anon, authenticated;

create trigger set_review_author
  before insert or update on public.review
  for each row execute function private.set_review_author();

update public.review r set author_name = n.name from public.netflix_tables n where n.id = r.user_id;

-- 4. Ticket numbers come from the database, so two users can't get the same one --------------------------------------
create sequence public.ticket_number_seq start 48400;
revoke all on sequence public.ticket_number_seq from anon, authenticated;
grant usage on sequence public.ticket_number_seq to authenticated;
alter table public.tickets alter column ticket_number set default 'NF-' || nextval('public.ticket_number_seq');

-- 5. Affiliates: one account per user, plus the application fields the app collects ---------------------------------
alter table public.affiliates
  add column payout_method varchar,
  add column audience_size varchar,
  add constraint affiliates_user_id_key unique (user_id);

-- 6. Promo codes: valid codes live in promotions; promo_codes holds the one code applied to each account ------------
-- Neither is writable from the browser: the apply-promo Edge Function (secret key) does it. promotions has RLS on and
-- no anon/authenticated grants, so it is invisible to clients but readable by the function through the REST API.
create table public.promotions (
  code varchar primary key,
  percent_off smallint not null check (percent_off between 1 and 100),
  plan varchar check (plan in ('basic', 'standard', 'premium')) -- null: any plan
);
revoke all on public.promotions from anon, authenticated;
grant select on public.promotions to service_role;
alter table public.promotions enable row level security;
insert into public.promotions (code, percent_off, plan) values
  ('WELCOME50', 50, null), ('STUDENT20', 20, null), ('FAMILY15', 15, 'premium');

delete from public.promo_codes where user_id is null;
alter table public.promo_codes
  drop constraint promo_codes_code_key,
  drop constraint promo_codes_user_id_fkey,
  alter column user_id set not null,
  alter column applied_at set default now(),
  add constraint promo_codes_user_id_key unique (user_id),
  add constraint promo_codes_user_id_fkey foreign key (user_id) references public.netflix_tables (id) on delete cascade;

-- 7. Temporary demo accounts (and e2e test sign-ups) are deleted after 24 hours; their rows go with them ------------
create extension if not exists pg_cron with schema pg_catalog;

create function private.delete_expired_demo_accounts()
returns integer
language sql
security definer
set search_path = ''
as $$
  with gone as (
    delete from auth.users
    where created_at < now() - interval '24 hours'
      and ((raw_app_meta_data ->> 'demo') = 'true' or email like 'e2e-%@example.com')
    returning 1
  )
  select count(*)::integer from gone;
$$;

revoke execute on function private.delete_expired_demo_accounts() from public, anon, authenticated;

select cron.schedule('delete-expired-demo-accounts', '17 * * * *', 'select private.delete_expired_demo_accounts()');
