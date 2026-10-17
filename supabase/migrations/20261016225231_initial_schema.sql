-- Netflix Clone schema, from ../schema.sql and ../drawsql.png, adapted for Supabase:
--   * netflix_tables.id is the Supabase Auth user id; Supabase Auth stores and checks passwords, so there is no
--     password_hash column (a hash in a Data API table could be read by any client the policies allow).
--   * ids default to gen_random_uuid(), user_id defaults to the signed-in user, created_at defaults to now().
--   * genres, cast_members and mood are text[] so the REST API returns arrays; titles gains mood and tint (the
--     CSS filter the app applies to the poster image).
--   * preferences.user_id is unique (one row per user) and tickets.title_id references titles.
--   * Every table has RLS. The project's default privileges grant anon/authenticated everything on new tables,
--     so each table starts with REVOKE ALL and then grants only what its policies need.

-- Accounts (profile row per Supabase Auth user) ---------------------------------------------------------------

create table public.netflix_tables (
  id uuid primary key references auth.users (id) on delete cascade,
  name varchar not null default '',
  email varchar not null unique,
  plan varchar not null default 'standard' check (plan in ('basic', 'standard', 'premium')),
  membership_status varchar not null default 'active' check (membership_status in ('active', 'paused', 'cancelled')),
  resumes_on date, -- set while paused
  ends_on date, -- set once cancelled
  billing_day smallint check (billing_day between 1 and 28),
  card_brand varchar, -- only brand, last four and expiry are stored, never the full number or CVC
  card_last4 char(4) check (card_last4 ~ '^[0-9]{4}$'),
  card_exp char(5) check (card_exp ~ '^(0[1-9]|1[0-2])/[0-9]{2}$'), -- MM/YY
  data_opt_out boolean not null default false, -- Do Not Sell
  last_sign_in timestamptz,
  access_removed_at timestamptz, -- set by Delete account; data stays until a data removal ticket is handled
  created_at timestamptz not null default now()
);

-- Catalog ------------------------------------------------------------------------------------------------------

create table public.titles (
  id varchar primary key, -- catalog slug, e.g. 'after-dark'
  title varchar not null,
  type varchar not null check (type in ('movie', 'show')),
  release_year smallint,
  maturity_rating varchar, -- e.g. 'TV-14', 'PG-13'
  seasons smallint, -- shows only
  runtime varchar, -- movies only, e.g. '1h 52m'
  genres text[] not null default '{}',
  mood text[] not null default '{}',
  synopsis text,
  cast_members text[] not null default '{}',
  director varchar,
  writer varchar,
  popularity smallint,
  is_new boolean not null default false,
  top10_rank smallint unique,
  image_url varchar,
  tint varchar not null default 'none' -- CSS filter that keeps titles sharing a photo from looking identical
);

-- Per-user data ------------------------------------------------------------------------------------------------

create table public.watch_list_tables (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.netflix_tables (id) on delete cascade,
  title_id varchar not null references public.titles (id) on delete cascade,
  added_at timestamptz not null default now(),
  unique (user_id, title_id)
);

create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.netflix_tables (id) on delete cascade,
  title_id varchar not null references public.titles (id) on delete cascade,
  added_at timestamptz not null default now(),
  unique (user_id, title_id)
);

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.netflix_tables (id) on delete cascade,
  ticket_number varchar not null unique, -- e.g. 'NF-48210'
  issue_type varchar not null, -- includes 'Captions or accessibility' and 'Data removal request'
  title_id varchar references public.titles (id) on delete set null, -- optional: the title the issue happened on
  summary text not null,
  steps text,
  device varchar,
  status varchar not null default 'Open',
  created_at timestamptz not null default now()
);

create table public.review (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.netflix_tables (id) on delete cascade,
  title_id varchar not null references public.titles (id) on delete cascade,
  rating smallint check (rating between 1 and 5), -- star rating; a rating alone has no body
  body text,
  created_at timestamptz not null default now()
);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.netflix_tables (id) on delete cascade,
  score smallint not null check (score between 1 and 5),
  area varchar not null,
  message text not null,
  created_at timestamptz not null default now()
);

create table public.preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique default auth.uid() references public.netflix_tables (id) on delete cascade,
  autoplay_next boolean,
  autoplay_previews boolean,
  email_updates boolean,
  personalized boolean,
  maturity_rating varchar
);

create table public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.netflix_tables (id) on delete set null,
  code varchar not null unique,
  percent_off smallint check (percent_off between 1 and 100),
  plan varchar,
  applied_at timestamptz
);

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.netflix_tables (id) on delete cascade,
  title_id varchar not null references public.titles (id) on delete cascade,
  release_date date,
  created_at timestamptz not null default now(),
  unique (user_id, title_id)
);

create table public.game_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.netflix_tables (id) on delete cascade,
  game varchar not null,
  best_score int,
  created_at timestamptz not null default now(),
  unique (user_id, game)
);

create table public.affiliates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.netflix_tables (id) on delete cascade,
  referral_code varchar not null unique,
  website_url varchar,
  channels text,
  accepted_terms boolean,
  tier varchar,
  created_at timestamptz not null default now()
);

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates (id) on delete cascade,
  kind varchar check (kind in ('click', 'signup')),
  created_at timestamptz not null default now()
);

create table public.accessibility_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique default auth.uid() references public.netflix_tables (id) on delete cascade,
  text_size smallint not null default 100 check (text_size in (100, 115, 130, 150)),
  font varchar not null default 'default' check (font in ('default', 'readable', 'dyslexia')),
  line_height varchar not null default 'default' check (line_height in ('default', 'relaxed', 'loose')),
  letter_spacing varchar not null default 'default' check (letter_spacing in ('default', 'wide', 'wider')),
  align_left boolean not null default false,
  contrast varchar not null default 'default' check (contrast in ('default', 'high')),
  saturation varchar not null default 'default' check (saturation in ('default', 'low', 'mono')),
  highlight_links boolean not null default false,
  highlight_headings boolean not null default false,
  strong_focus boolean not null default false,
  big_cursor boolean not null default false,
  reading_guide boolean not null default false,
  hide_images boolean not null default false,
  stop_animations boolean not null default false,
  captions boolean not null default false,
  caption_size varchar not null default 'medium' check (caption_size in ('medium', 'large', 'xlarge')),
  updated_at timestamptz not null default now()
);

-- Create the profile row when someone signs up -------------------------------------------------------------------
-- Lives in a schema the Data API doesn't expose. SECURITY DEFINER is needed because the insert runs as the auth
-- service, and clients have no INSERT grant on netflix_tables. raw_user_meta_data only fills display fields here,
-- never anything used for authorization.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.netflix_tables (id, email, name, plan)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    case when new.raw_user_meta_data ->> 'plan' in ('basic', 'standard', 'premium')
      then new.raw_user_meta_data ->> 'plan' else 'standard' end
  );
  return new;
end;
$$;

revoke execute on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Grants: start from nothing, then add only what the policies below use -----------------------------------------

revoke all on
  public.netflix_tables, public.titles, public.watch_list_tables, public.favorites, public.tickets, public.review,
  public.feedback, public.preferences, public.promo_codes, public.reminders, public.game_scores, public.affiliates,
  public.referrals, public.accessibility_settings
from anon, authenticated;

grant select on public.titles to anon, authenticated;
grant select on public.review to anon, authenticated;

-- Account holders can edit their own profile, but not their id, email (owned by Supabase Auth) or audit columns
grant select on public.netflix_tables to authenticated;
grant update (name, plan, membership_status, resumes_on, ends_on, billing_day, card_brand, card_last4, card_exp,
  data_opt_out, access_removed_at) on public.netflix_tables to authenticated;

grant select, insert, update, delete on
  public.watch_list_tables, public.favorites, public.review, public.preferences, public.reminders,
  public.game_scores, public.accessibility_settings
to authenticated;

-- Submitted once, then handled by support
grant select, insert on public.tickets, public.feedback to authenticated;

grant select, insert, update on public.affiliates to authenticated;
grant select on public.referrals, public.promo_codes to authenticated;

-- Row level security -------------------------------------------------------------------------------------------

alter table public.netflix_tables enable row level security;
alter table public.titles enable row level security;
alter table public.watch_list_tables enable row level security;
alter table public.favorites enable row level security;
alter table public.tickets enable row level security;
alter table public.review enable row level security;
alter table public.feedback enable row level security;
alter table public.preferences enable row level security;
alter table public.promo_codes enable row level security;
alter table public.reminders enable row level security;
alter table public.game_scores enable row level security;
alter table public.affiliates enable row level security;
alter table public.referrals enable row level security;
alter table public.accessibility_settings enable row level security;

create policy "Anyone can browse the catalog" on public.titles
  for select to anon, authenticated using (true);

create policy "Users read their own account" on public.netflix_tables
  for select to authenticated using ((select auth.uid()) = id);
create policy "Users update their own account" on public.netflix_tables
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "Anyone can read reviews" on public.review
  for select to anon, authenticated using (true);
create policy "Users write their own reviews" on public.review
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users edit their own reviews" on public.review
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete their own reviews" on public.review
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Same owner-only CRUD for every table that is simply "a user's own rows"
do $$
declare
  t text;
begin
  foreach t in array array['watch_list_tables', 'favorites', 'preferences', 'reminders', 'game_scores',
    'accessibility_settings']
  loop
    execute format('create policy "Users read their own rows" on public.%I for select to authenticated
      using ((select auth.uid()) = user_id)', t);
    execute format('create policy "Users add their own rows" on public.%I for insert to authenticated
      with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "Users update their own rows" on public.%I for update to authenticated
      using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "Users delete their own rows" on public.%I for delete to authenticated
      using ((select auth.uid()) = user_id)', t);
  end loop;

  foreach t in array array['tickets', 'feedback']
  loop
    execute format('create policy "Users read their own rows" on public.%I for select to authenticated
      using ((select auth.uid()) = user_id)', t);
    execute format('create policy "Users submit their own rows" on public.%I for insert to authenticated
      with check ((select auth.uid()) = user_id)', t);
  end loop;
end;
$$;

create policy "Users read their own affiliate account" on public.affiliates
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users apply for an affiliate account" on public.affiliates
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update their own affiliate account" on public.affiliates
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Referrals are recorded server-side (service role); affiliates can only see their own
create policy "Affiliates read their own referrals" on public.referrals
  for select to authenticated using (
    exists (select 1 from public.affiliates a where a.id = affiliate_id and a.user_id = (select auth.uid()))
  );

-- Codes are issued server-side; users can see the codes applied to their account
create policy "Users read codes applied to their account" on public.promo_codes
  for select to authenticated using ((select auth.uid()) = user_id);
