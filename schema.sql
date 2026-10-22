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
-- 2026-10-22 (ten more features):
-- - ..._profiles: new table profiles (up to five per account, each with its own maturity rating); watch lists,
--   favorites, reminders, watch progress and game scores belong to a profile (profile_id, unique per profile);
--   preferences.maturity_rating is superseded by profiles.maturity_rating.
-- - ..._support_dashboard: new tables staff and ticket_replies; tickets.status is checked. Staff read the queue
--   through staff_tickets() and staff_set_ticket_status().
-- - ..._notifications: profiles gains notifications_seen_at; reminders keep their release_date.
-- - ..._viewing_history: new table viewing_history; preferences gains keep_viewing_history and
--   history_retention_days (old history is deleted nightly).
-- - ..._custom_lists: new tables custom_lists and custom_list_items; shared_list(slug) shows a public list.
-- - ..._watch_parties: new tables watch_parties and watch_party_members; join_watch_party(code); party channels are
--   private Realtime channels limited to members.
-- - ..._better_search: search_titles(query) (pg_trgm); new table recent_searches.
-- 2026-10-23 (seven more features):
-- - ..._title_reactions: new table title_reactions (a profile's thumbs ratings: Not for me, I like this, Love this!).
-- - ..._year_in_review: year_in_review(profile, year) sums up a profile's viewing history for a year.
-- - ..._profile_locks: profiles gains locked; the PIN hashes are in private.profile_pins (not part of the API, so not
--   drawn); set_profile_pin(), unlock_profile() and verify_account_password() check PINs and the account password.
-- - ..._two_step_sign_in: no new tables. A restrictive policy on every table keeps a session that hasn't entered its
--   two-step code (Supabase Auth MFA) away from all data (second_step_done()); my_sessions() and end_session() list
--   and sign out the member's devices (auth.sessions).
-- - ..._second_step_for_definer_functions: staff_tickets(), staff_set_ticket_status() and join_watch_party() also
--   refuse a session that hasn't entered its two-step code.
-- 2026-10-23 (donations):
-- - ..._donations: new table donations (one-time Stripe donations, recorded by the stripe-webhook function; members
--   only read their own).
-- 2026-10-24 (eight more features):
-- - ..._screen_time: profiles gains daily_limit_minutes (only set_screen_time_limit() changes it, with the account
--   password); new table screen_time (seconds watched per profile and day), changed only through add_screen_time() and
--   add_extra_screen_time(); rows older than a week are deleted nightly.
-- - ..._caption_language: accessibility_settings gains caption_language ('en' or 'es').
-- - ..._review_reports: new table review_reports (a member's report of another member's review, with a copy of it);
--   staff read them through staff_review_reports() and keep or remove the review with staff_resolve_review().

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

-- Who's watching: one to five per account (a trigger enforces the limits). Lists, reminders, Continue Watching,
-- game scores, history, custom lists and recent searches belong to a profile; (id, user_id) is unique so those rows
-- can reference both and a row's profile always belongs to its account.
CREATE TABLE profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES netflix_tables (id) ON DELETE CASCADE, -- defaults to auth.uid()
  name varchar NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 30),
  avatar varchar NOT NULL DEFAULT 'blue' CHECK (avatar IN ('blue', 'red', 'yellow', 'green', 'purple')),
  maturity_rating varchar NOT NULL DEFAULT 'all' CHECK (maturity_rating IN ('all', 'teen', 'kids')),
  notifications_seen_at timestamptz NOT NULL DEFAULT now(), -- when the profile last opened its notifications
  locked boolean NOT NULL DEFAULT false, -- has a PIN (only set_profile_pin() changes it)
  daily_limit_minutes smallint CHECK (daily_limit_minutes IN (30, 60, 90, 120, 180, 240)), -- screen-time limit; null = none
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, user_id),
  UNIQUE (user_id, name)
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
  profile_id uuid NOT NULL, -- the account's first profile when not given
  UNIQUE (profile_id, title_id),
  FOREIGN KEY (profile_id, user_id) REFERENCES profiles (id, user_id) ON DELETE CASCADE
);

CREATE TABLE favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES netflix_tables (id) ON DELETE CASCADE,
  title_id varchar NOT NULL REFERENCES titles (id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  profile_id uuid NOT NULL, -- the account's first profile when not given
  UNIQUE (profile_id, title_id),
  FOREIGN KEY (profile_id, user_id) REFERENCES profiles (id, user_id) ON DELETE CASCADE
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
  status varchar NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'In progress', 'Resolved')), -- set by support staff only
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
  maturity_rating varchar, -- superseded by profiles.maturity_rating (copied there); no longer read
  player_volume smallint CHECK (player_volume BETWEEN 0 AND 100), -- video player volume; null = full volume
  show_on_leaderboards boolean NOT NULL DEFAULT false, -- opt-in: first name and best scores on game leaderboards
  keep_viewing_history boolean NOT NULL DEFAULT true, -- off: nothing new goes into viewing history or recent searches
  history_retention_days smallint CHECK (history_retention_days IN (90, 365)) -- older history is deleted nightly; null = kept
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
  release_date date, -- when a TMDB title (or a show's next episode) comes out; the bell announces it that day
  created_at timestamptz NOT NULL DEFAULT now(),
  profile_id uuid NOT NULL, -- the account's first profile when not given
  UNIQUE (profile_id, title_id),
  FOREIGN KEY (profile_id, user_id) REFERENCES profiles (id, user_id) ON DELETE CASCADE
);

CREATE TABLE game_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES netflix_tables (id) ON DELETE CASCADE,
  game varchar NOT NULL,
  best_score int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(), -- when the best score was set; leaderboard ties go to the earlier one
  profile_id uuid NOT NULL, -- the account's first profile when not given
  UNIQUE (profile_id, game),
  FOREIGN KEY (profile_id, user_id) REFERENCES profiles (id, user_id) ON DELETE CASCADE
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
  profile_id uuid NOT NULL, -- the account's first profile when not given
  UNIQUE (profile_id, title_id),
  FOREIGN KEY (profile_id, user_id) REFERENCES profiles (id, user_id) ON DELETE CASCADE
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
  caption_language varchar NOT NULL DEFAULT 'en' CHECK (caption_language IN ('en', 'es')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One row per call to a public Edge Function, keyed e.g. 'demo-account:203.0.113.7' or 'tmdb:203.0.113.7' (TMDB
-- lookups the function's cache can't answer). Only the functions can use it; hits older than a day are deleted hourly.
CREATE TABLE rate_limit_hits (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key varchar NOT NULL,
  hit_at timestamptz NOT NULL DEFAULT now()
);

-- Support staff (added by the project owner in the SQL editor). A member can read only their own row.
CREATE TABLE staff (
  user_id uuid PRIMARY KEY REFERENCES netflix_tables (id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now()
);

-- The conversation on a ticket: the member and support staff reply; from_staff and author_name are set by a trigger
CREATE TABLE ticket_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES tickets (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES netflix_tables (id) ON DELETE CASCADE,
  from_staff boolean NOT NULL DEFAULT false,
  author_name varchar NOT NULL DEFAULT '', -- 'Support team' for staff
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Viewing activity: one row per profile, title and episode (0 for movies) per day watched
CREATE TABLE viewing_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES netflix_tables (id) ON DELETE CASCADE,
  profile_id uuid NOT NULL,
  title_id varchar NOT NULL REFERENCES titles (id) ON DELETE CASCADE,
  episode smallint NOT NULL DEFAULT 0 CHECK (episode >= 0),
  watched_on date NOT NULL DEFAULT current_date, -- the viewer's own day
  watched_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (profile_id, user_id) REFERENCES profiles (id, user_id) ON DELETE CASCADE,
  UNIQUE (profile_id, title_id, episode, watched_on)
);

-- A profile's own named lists; public ones can be opened by anyone with the link (shared_list(share_slug))
CREATE TABLE custom_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES netflix_tables (id) ON DELETE CASCADE,
  profile_id uuid NOT NULL,
  name varchar NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 60),
  description varchar CHECK (char_length(description) <= 280),
  is_public boolean NOT NULL DEFAULT false,
  share_slug varchar NOT NULL UNIQUE, -- 16 random hex characters
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (profile_id, user_id) REFERENCES profiles (id, user_id) ON DELETE CASCADE,
  UNIQUE (profile_id, name)
);

CREATE TABLE custom_list_items (
  list_id uuid NOT NULL REFERENCES custom_lists (id) ON DELETE CASCADE,
  title_id varchar NOT NULL REFERENCES titles (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES netflix_tables (id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (list_id, title_id)
);

-- Watch parties: six hours long; play, pause, presence and chat travel over the private Realtime channel
-- party:<code>, which only members can join
CREATE TABLE watch_parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar NOT NULL UNIQUE, -- 10 random hex characters, the invite link's code
  host_id uuid NOT NULL REFERENCES netflix_tables (id) ON DELETE CASCADE,
  title_id varchar NOT NULL REFERENCES titles (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '6 hours'
);

CREATE TABLE watch_party_members (
  party_id uuid NOT NULL REFERENCES watch_parties (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES netflix_tables (id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (party_id, user_id)
);

-- A profile's last ten searches; the same words in any case count once
CREATE TABLE recent_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES netflix_tables (id) ON DELETE CASCADE,
  profile_id uuid NOT NULL,
  query varchar NOT NULL CHECK (char_length(btrim(query)) BETWEEN 1 AND 100),
  query_key varchar GENERATED ALWAYS AS (lower(btrim(query))) STORED,
  searched_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (profile_id, user_id) REFERENCES profiles (id, user_id) ON DELETE CASCADE,
  UNIQUE (profile_id, query_key)
);

-- A profile's thumbs ratings: 'dislike' (Not for me: never recommended to that profile), 'like', 'love'
CREATE TABLE title_reactions (
  user_id uuid NOT NULL REFERENCES netflix_tables (id) ON DELETE CASCADE,
  profile_id uuid NOT NULL,
  title_id varchar NOT NULL REFERENCES titles (id) ON DELETE CASCADE,
  reaction varchar NOT NULL CHECK (reaction IN ('dislike', 'like', 'love')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, title_id),
  FOREIGN KEY (profile_id, user_id) REFERENCES profiles (id, user_id) ON DELETE CASCADE
);

-- One-time donations through Stripe, in cents (USD). Written only by the stripe-webhook function (service role), one
-- row per PaymentIntent; a failed donation can become 'succeeded' when the card is retried, never the reverse
CREATE TABLE donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES netflix_tables (id) ON DELETE CASCADE,
  amount integer NOT NULL CHECK (amount > 0 AND amount <= 1000000),
  stripe_payment_intent_id text NOT NULL UNIQUE,
  status text NOT NULL CHECK (status IN ('succeeded', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Screen time per profile and (the member's local) day, for profiles with a daily limit. Members read their own rows;
-- add_screen_time() counts up in steps of at most 60 seconds and add_extra_screen_time() allows more time with the
-- account password. Rows older than a week are deleted nightly.
CREATE TABLE screen_time (
  user_id uuid NOT NULL REFERENCES netflix_tables (id) ON DELETE CASCADE,
  profile_id uuid NOT NULL,
  day date NOT NULL,
  seconds integer NOT NULL DEFAULT 0 CHECK (seconds BETWEEN 0 AND 86400),
  extra_seconds integer NOT NULL DEFAULT 0 CHECK (extra_seconds BETWEEN 0 AND 86400),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, day),
  FOREIGN KEY (profile_id, user_id) REFERENCES profiles (id, user_id) ON DELETE CASCADE
);

-- A member's report of another member's review. A trigger fills in the reporter and a copy of the review (kept when
-- staff remove it); members read their own reports; staff settle them through staff_resolve_review().
CREATE TABLE review_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid REFERENCES review (id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES netflix_tables (id) ON DELETE CASCADE,
  reason varchar NOT NULL CHECK (reason IN ('spoilers', 'offensive', 'spam', 'other')),
  details text CHECK (details IS NULL OR char_length(details) <= 500),
  title_id varchar,
  review_author varchar NOT NULL DEFAULT '',
  review_body text NOT NULL DEFAULT '',
  status varchar NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Kept', 'Removed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  UNIQUE (review_id, user_id)
);
