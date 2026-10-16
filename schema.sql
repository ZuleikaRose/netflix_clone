-- Netflix Clone database schema (PostgreSQL), matching drawsql.png.
-- Import into DrawSQL with "Import" > PostgreSQL to keep editing the diagram.

CREATE TABLE netflix_tables (
  id uuid PRIMARY KEY,
  name varchar NOT NULL,
  email varchar NOT NULL UNIQUE,
  password_hash varchar NOT NULL,
  plan varchar NOT NULL, -- 'basic', 'standard' or 'premium'
  membership_status varchar NOT NULL DEFAULT 'active', -- 'active', 'paused' or 'cancelled'
  resumes_on date, -- set while paused
  ends_on date, -- set once cancelled
  billing_day smallint, -- 1 to 28
  card_brand varchar, -- only brand, last four and expiry are stored, never the full number or CVC
  card_last4 char(4),
  card_exp char(5), -- MM/YY
  data_opt_out boolean NOT NULL DEFAULT false, -- Do Not Sell
  last_sign_in timestamptz,
  access_removed_at timestamptz, -- set by Delete account (only allowed once membership_status is 'cancelled'); data stays until a data removal ticket is handled
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE titles (
  id varchar PRIMARY KEY, -- catalog slug, e.g. 'after-dark'
  title varchar NOT NULL,
  type varchar NOT NULL, -- 'movie' or 'show'
  release_year smallint,
  maturity_rating varchar, -- e.g. 'TV-14', 'PG-13'
  seasons smallint, -- shows only
  runtime varchar, -- movies only, e.g. '1h 52m'
  genres text,
  synopsis text,
  cast_members text,
  director varchar,
  writer varchar,
  popularity smallint,
  is_new boolean NOT NULL DEFAULT false,
  top10_rank smallint,
  image_url varchar
);

CREATE TABLE watch_list_tables (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES netflix_tables (id),
  title_id varchar NOT NULL REFERENCES titles (id),
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, title_id)
);

CREATE TABLE favorites (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES netflix_tables (id),
  title_id varchar NOT NULL REFERENCES titles (id),
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, title_id)
);

CREATE TABLE tickets (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES netflix_tables (id),
  ticket_number varchar NOT NULL UNIQUE, -- e.g. 'NF-48210'
  issue_type varchar NOT NULL, -- includes 'Captions or accessibility' and 'Data removal request'
  title_id varchar, -- optional: the title the issue happened on
  summary text NOT NULL,
  steps text,
  device varchar,
  status varchar NOT NULL DEFAULT 'Open',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE review (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES netflix_tables (id),
  title_id varchar NOT NULL REFERENCES titles (id),
  rating smallint CHECK (rating BETWEEN 1 AND 5), -- star rating; a rating alone has no body
  body text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE feedback (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES netflix_tables (id),
  score smallint NOT NULL CHECK (score BETWEEN 1 AND 5),
  area varchar NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
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
  title_id varchar NOT NULL REFERENCES titles (id),
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

CREATE TABLE accessibility_settings (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES netflix_tables (id),
  text_size smallint NOT NULL DEFAULT 100, -- percent: 100, 115, 130 or 150
  font varchar NOT NULL DEFAULT 'default', -- 'default', 'readable' or 'dyslexia'
  line_height varchar NOT NULL DEFAULT 'default', -- 'default', 'relaxed' or 'loose'
  letter_spacing varchar NOT NULL DEFAULT 'default', -- 'default', 'wide' or 'wider'
  align_left boolean NOT NULL DEFAULT false,
  contrast varchar NOT NULL DEFAULT 'default', -- 'default' or 'high'
  saturation varchar NOT NULL DEFAULT 'default', -- 'default', 'low' or 'mono'
  highlight_links boolean NOT NULL DEFAULT false,
  highlight_headings boolean NOT NULL DEFAULT false,
  strong_focus boolean NOT NULL DEFAULT false,
  big_cursor boolean NOT NULL DEFAULT false,
  reading_guide boolean NOT NULL DEFAULT false,
  hide_images boolean NOT NULL DEFAULT false,
  stop_animations boolean NOT NULL DEFAULT false,
  captions boolean NOT NULL DEFAULT false,
  caption_size varchar NOT NULL DEFAULT 'medium', -- 'medium', 'large' or 'xlarge'
  updated_at timestamptz NOT NULL DEFAULT now()
);
