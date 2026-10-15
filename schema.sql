-- Netflix Clone database schema (PostgreSQL), matching drawsql.png.
-- Import into DrawSQL with "Import" > PostgreSQL to keep editing the diagram.

CREATE TABLE netflix_tables (
  id uuid PRIMARY KEY,
  name varchar NOT NULL,
  email varchar NOT NULL UNIQUE,
  "session time" timestamp,
  date date,
  accept_terms boolean,
  accept_privacy boolean,
  data_opt_out boolean,
  cancel_membership boolean,
  pause_membership boolean,
  title varchar,
  review smallint,
  has_billing boolean,
  has_free_plan boolean,
  has_subscription boolean,
  error_report bigint
);

CREATE TABLE watch_list_tables (
  id uuid PRIMARY KEY REFERENCES netflix_tables (id),
  has_watch_history boolean,
  title varchar
);

CREATE TABLE favorites (
  id uuid PRIMARY KEY REFERENCES netflix_tables (id),
  title varchar
);

CREATE TABLE tickets (
  id uuid PRIMARY KEY REFERENCES netflix_tables (id),
  ticket_number bigint,
  name varchar,
  subject text,
  reason text,
  days_open timestamptz
);

CREATE TABLE review (
  id uuid PRIMARY KEY REFERENCES netflix_tables (id),
  rating int
);

CREATE TABLE preferences (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES netflix_tables (id),
  autoplay_next boolean,
  autoplay_previews boolean,
  email_updates boolean,
  personalized boolean,
  maturity_rating varchar
);

CREATE TABLE promo_codes (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES netflix_tables (id),
  code varchar NOT NULL UNIQUE,
  percent_off smallint,
  plan varchar,
  applied_at timestamptz
);

CREATE TABLE reminders (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES netflix_tables (id),
  title varchar,
  release_date date,
  created_at timestamptz
);

CREATE TABLE game_scores (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES netflix_tables (id),
  game varchar,
  best_score int,
  created_at timestamptz
);

CREATE TABLE affiliates (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES netflix_tables (id),
  referral_code varchar NOT NULL UNIQUE,
  website_url varchar,
  channels text,
  accepted_terms boolean,
  tier varchar,
  created_at timestamptz
);

CREATE TABLE referrals (
  id uuid PRIMARY KEY,
  affiliate_id uuid NOT NULL REFERENCES affiliates (id),
  kind varchar, -- 'click' or 'signup'
  created_at timestamptz
);
