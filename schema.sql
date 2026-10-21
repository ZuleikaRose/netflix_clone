-- Netflix Clone database schema (PostgreSQL), matching drawsql.png and the live Supabase database.
-- The source of truth is supabase/migrations/ (which also holds RLS policies, grants, triggers and cron jobs);
-- this file is the plain table design, kept in step with it. Import into DrawSQL with "Import" > PostgreSQL to keep
-- editing the diagram (DrawSQL doesn't know Supabase's auth schema, so the auth.users reference is a comment).
--
-- Changes since the first design: passwords live in Supabase Auth (no password_hash); netflix_tables.id is the Auth
-- user id; ids, user_id and timestamps have defaults; titles gains mood and tint and uses text[] arrays; review gains
-- author_name; affiliates gain payout_method and audience_size; tickets are numbered by a sequence; one preferences,
-- promo code, affiliate and accessibility row per user; every child row is deleted with its account (ON DELETE
-- CASCADE); new tables promotions (valid promo codes) and rate_limit_hits (Edge Function rate limits).
-- TMDB (migration ..._tmdb_titles_and_player_volume): titles gains source ('catalog' or 'tmdb'), so TMDB titles members
-- save can sit in watch lists and favorites like catalog titles; new table tmdb_titles holds their TMDB-only details;
-- preferences gains player_volume.
-- Migration ..._watch_progress_and_leaderboards: new table watch_progress (Continue Watching per member); tmdb_titles
-- gains trailer_youtube_key; new table tmdb_certifications (US ratings of listed TMDB titles, used only by the tmdb
-- function); preferences gains show_on_leaderboards (opt-in); game_scores gains updated_at. Leaderboards are read
-- through the function game_leaderboard(game), which returns first names only.

CREATE SEQUENCE ticket_number_seq START 48400;

CREATE TABLE netflix_tables (
  id uuid PRIMARY KEY, -- = auth.users.id (ON DELETE CASCADE); passwords are stored and checked by Supabase Auth
  name varchar NOT NULL DEFAULT '',
  email varchar NOT NULL UNIQUE, -- copied from Supabase Auth by a trigger, lower-cased
  plan varchar NOT NULL DEFAULT 'standard' CHECK (plan IN ('basic', 'standard', 'premium')),
  membership_status varchar NOT NULL DEFAULT 'active' CHECK (membership_status IN ('active', 'paused', 'cancelled')),
  resumes_on date, -- set while paused
  ends_on date, -- set once cancelled
  billing_day smallint CHECK (billing_day BETWEEN 1 AND 28),
  card_brand varchar, -- only brand, last four and expiry are stored, never the full number or CVC
  card_last4 char(4) CHECK (card_last4 ~ '^[0-9]{4}$'),
  card_exp char(5) CHECK (card_exp ~ '^(0[1-9]|1[0-2])/[0-9]{2}$'), -- MM/YY
  data_opt_out boolean NOT NULL DEFAULT false, -- Do Not Sell
  last_sign_in timestamptz, -- copied from Supabase Auth by a trigger
  access_removed_at timestamptz, -- set by Delete account (only once membership_status is 'cancelled'); data stays until a data removal ticket is handled
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE titles (
  id varchar PRIMARY KEY, -- catalog slug, e.g. 'after-dark', or 'tmdb-<movie|show>-<TMDB id>' for a saved TMDB title
  title varchar NOT NULL,
  type varchar NOT NULL CHECK (type IN ('movie', 'show')),
  release_year smallint,
  maturity_rating varchar, -- e.g. 'TV-14', 'PG-13'
  seasons smallint, -- shows only
  runtime varchar, -- movies only, e.g. '1h 52m'
  genres text[] NOT NULL DEFAULT '{}',
  mood text[] NOT NULL DEFAULT '{}',
  synopsis text,
  cast_members text[] NOT NULL DEFAULT '{}',
  director varchar,
  writer varchar,
  popularity smallint,
  is_new boolean NOT NULL DEFAULT false,
  top10_rank smallint UNIQUE,
  image_url varchar,
  tint varchar NOT NULL DEFAULT 'none', -- CSS filter the app applies to the poster image
  source varchar NOT NULL DEFAULT 'catalog' CHECK (source IN ('catalog', 'tmdb')) -- 'tmdb' rows are added only by the tmdb Edge Function
);

-- The TMDB-only details of each TMDB title a member has saved (its core fields are a titles row). Anyone can read it;
-- only the tmdb Edge Function writes it, from TMDB's own data.
CREATE TABLE tmdb_titles (
  title_id varchar PRIMARY KEY REFERENCES titles (id) ON DELETE CASCADE, -- e.g. 'tmdb-movie-603'
  tmdb_id integer NOT NULL,
  media_type varchar NOT NULL CHECK (media_type IN ('movie', 'tv')),
  backdrop_url varchar,
  tmdb_rating numeric(3, 1) CHECK (tmdb_rating BETWEEN 0 AND 10),
  tmdb_url varchar NOT NULL,
  trailer_youtube_key varchar, -- the YouTube video key of the title's trailer, if TMDB lists one
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (media_type, tmdb_id)
);

-- US certifications (PG-13, TV-MA…) of the TMDB titles the app lists, looked up once per title ('NR' when TMDB has
-- none) so restricted profiles see the ones within their setting. Only the tmdb Edge Function reads or writes it.
CREATE TABLE tmdb_certifications (
  media_type varchar NOT NULL CHECK (media_type IN ('movie', 'tv')),
  tmdb_id integer NOT NULL,
  certification varchar NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(), -- looked up again after 30 days
  PRIMARY KEY (media_type, tmdb_id)
);

CREATE TABLE watch_list_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES netflix_tables (id) ON DELETE CASCADE, -- defaults to auth.uid()
  title_id varchar NOT NULL REFERENCES titles (id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, title_id)
);

CREATE TABLE favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES netflix_tables (id) ON DELETE CASCADE,
  title_id varchar NOT NULL REFERENCES titles (id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, title_id)
);

CREATE TABLE tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES netflix_tables (id) ON DELETE CASCADE,
  ticket_number varchar NOT NULL UNIQUE DEFAULT ('NF-' || nextval('ticket_number_seq')), -- e.g. 'NF-48400'
  issue_type varchar NOT NULL, -- includes 'Captions or accessibility' and 'Data removal request'
  title_id varchar REFERENCES titles (id) ON DELETE SET NULL, -- optional: the title the issue happened on
  summary text NOT NULL,
  steps text,
  device varchar,
  status varchar NOT NULL DEFAULT 'Open', -- members can't edit a ticket after submitting it
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE review (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES netflix_tables (id) ON DELETE CASCADE,
  title_id varchar NOT NULL REFERENCES titles (id) ON DELETE CASCADE,
  rating smallint CHECK (rating BETWEEN 1 AND 5), -- star rating; a rating alone has no body
  body text,
  author_name varchar NOT NULL DEFAULT '', -- set from the author's account by a trigger, so it can't be faked
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES netflix_tables (id) ON DELETE CASCADE,
  score smallint NOT NULL CHECK (score BETWEEN 1 AND 5),
  area varchar NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES netflix_tables (id) ON DELETE CASCADE, -- created at sign-up
  autoplay_next boolean,
  autoplay_previews boolean,
  email_updates boolean,
  personalized boolean,
  maturity_rating varchar,
  player_volume smallint CHECK (player_volume BETWEEN 0 AND 100), -- video player volume; null = full volume
  show_on_leaderboards boolean NOT NULL DEFAULT false -- opt-in: first name and best scores on game leaderboards
);

-- The valid promo codes (WELCOME50, STUDENT20, FAMILY15). Only the apply-promo Edge Function can read it.
CREATE TABLE promotions (
  code varchar PRIMARY KEY,
  percent_off smallint NOT NULL CHECK (percent_off BETWEEN 1 AND 100),
  plan varchar CHECK (plan IN ('basic', 'standard', 'premium')) -- null = any plan
);

-- The code a member has applied (at most one). Written only by the apply-promo Edge Function.
CREATE TABLE promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES netflix_tables (id) ON DELETE CASCADE,
  code varchar NOT NULL,
  percent_off smallint CHECK (percent_off BETWEEN 1 AND 100),
  plan varchar,
  applied_at timestamptz DEFAULT now()
);

CREATE TABLE reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES netflix_tables (id) ON DELETE CASCADE,
  title_id varchar NOT NULL REFERENCES titles (id) ON DELETE CASCADE,
  release_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, title_id)
);

CREATE TABLE game_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES netflix_tables (id) ON DELETE CASCADE,
  game varchar NOT NULL,
  best_score int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(), -- when the best score was set; leaderboard ties go to the earlier one
  UNIQUE (user_id, game)
);

-- Where each member stopped in each title (Continue Watching on any device). A finished movie's row is removed; a
-- finished episode moves the row to the start of the next one.
CREATE TABLE watch_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES netflix_tables (id) ON DELETE CASCADE, -- defaults to auth.uid()
  title_id varchar NOT NULL REFERENCES titles (id) ON DELETE CASCADE,
  episode smallint NOT NULL DEFAULT 1 CHECK (episode >= 1), -- shows only; movies stay at 1
  position_seconds numeric(8, 1) NOT NULL DEFAULT 0 CHECK (position_seconds >= 0),
  progress_percent smallint NOT NULL CHECK (progress_percent BETWEEN 0 AND 100),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, title_id)
);

CREATE TABLE affiliates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES netflix_tables (id) ON DELETE CASCADE,
  referral_code varchar NOT NULL UNIQUE, -- e.g. 'JORDAN7Q2K'
  website_url varchar,
  channels text,
  payout_method varchar,
  audience_size varchar,
  accepted_terms boolean,
  tier varchar,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES affiliates (id) ON DELETE CASCADE,
  kind varchar CHECK (kind IN ('click', 'signup')), -- clicks: record-referral function; sign-ups: sign-up trigger
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE accessibility_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES netflix_tables (id) ON DELETE CASCADE,
  text_size smallint NOT NULL DEFAULT 100 CHECK (text_size IN (100, 115, 130, 150)), -- percent
  font varchar NOT NULL DEFAULT 'default' CHECK (font IN ('default', 'readable', 'dyslexia')),
  line_height varchar NOT NULL DEFAULT 'default' CHECK (line_height IN ('default', 'relaxed', 'loose')),
  letter_spacing varchar NOT NULL DEFAULT 'default' CHECK (letter_spacing IN ('default', 'wide', 'wider')),
  align_left boolean NOT NULL DEFAULT false,
  contrast varchar NOT NULL DEFAULT 'default' CHECK (contrast IN ('default', 'high')),
  saturation varchar NOT NULL DEFAULT 'default' CHECK (saturation IN ('default', 'low', 'mono')),
  highlight_links boolean NOT NULL DEFAULT false,
  highlight_headings boolean NOT NULL DEFAULT false,
  strong_focus boolean NOT NULL DEFAULT false,
  big_cursor boolean NOT NULL DEFAULT false,
  reading_guide boolean NOT NULL DEFAULT false,
  hide_images boolean NOT NULL DEFAULT false,
  stop_animations boolean NOT NULL DEFAULT false,
  captions boolean NOT NULL DEFAULT false,
  caption_size varchar NOT NULL DEFAULT 'medium' CHECK (caption_size IN ('medium', 'large', 'xlarge')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One row per call to a public Edge Function, keyed e.g. 'demo-account:203.0.113.7' or 'tmdb:203.0.113.7' (TMDB
-- lookups the function's cache can't answer). Only the functions can use it; hits older than a day are deleted hourly.
CREATE TABLE rate_limit_hits (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key varchar NOT NULL,
  hit_at timestamptz NOT NULL DEFAULT now()
);
