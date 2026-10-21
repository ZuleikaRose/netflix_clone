-- Test data for the Netflix Clone (development only — do not run against production).
-- Needs the migrations in ./migrations first (schema + catalog titles).
--
-- Six test users with fixed ids. Alex is the app's demo account; the others are the authors of the sample reviews in
-- netflix_clone/src/data/catalog.js. Emails use example.com, which can't receive mail.
-- No passwords are set (encrypted_password is empty), so nobody can sign in as these users with a password.
-- Re-runnable: deleting the test users cascades to every row below.

delete from auth.users where id in (
  'a1e00000-0000-4000-8000-000000000001', 'a1e00000-0000-4000-8000-000000000002',
  'a1e00000-0000-4000-8000-000000000003', 'a1e00000-0000-4000-8000-000000000004',
  'a1e00000-0000-4000-8000-000000000005', 'a1e00000-0000-4000-8000-000000000006'
);

-- Auth users. The on_auth_user_created trigger creates each netflix_tables row from email + metadata.
-- The token columns must be '' rather than null, or Supabase Auth fails to load the user.
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', u.id::uuid, 'authenticated', 'authenticated', u.email, '', now(),
  '{"provider": "email", "providers": ["email"]}', jsonb_build_object('name', u.name, 'plan', u.plan),
  now() - u.age, now(), '', '', '', ''
from (values
  ('a1e00000-0000-4000-8000-000000000001', 'alex@example.com', 'Alex', 'standard', interval '120 days'),
  ('a1e00000-0000-4000-8000-000000000002', 'jordan.test@example.com', 'Jordan', 'premium', interval '300 days'),
  ('a1e00000-0000-4000-8000-000000000003', 'sam.test@example.com', 'Sam', 'basic', interval '90 days'),
  ('a1e00000-0000-4000-8000-000000000004', 'priya.test@example.com', 'Priya', 'premium', interval '45 days'),
  ('a1e00000-0000-4000-8000-000000000005', 'chris.test@example.com', 'Chris', 'standard', interval '400 days'),
  ('a1e00000-0000-4000-8000-000000000006', 'dana.test@example.com', 'Dana', 'standard', interval '20 days')
) as u (id, email, name, plan, age);

insert into auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text, 'email',
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), now(), now()
from auth.users u
where u.id::text like 'a1e00000-0000-4000-8000-00000000000_';

-- The sign-up trigger creates each account and preferences row; this sets billing (brand, last four and expiry only), membership states and sign-in times
update public.netflix_tables n set
  billing_day = v.billing_day, card_brand = v.brand, card_last4 = v.last4, card_exp = v.exp,
  membership_status = v.status, resumes_on = v.resumes_on, ends_on = v.ends_on,
  data_opt_out = v.opt_out, last_sign_in = now() - v.last_seen
from (values
  ('a1e00000-0000-4000-8000-000000000001'::uuid, 15, 'Visa', '4242', '08/28', 'active', null::date, null::date, false, interval '1 hour'),
  ('a1e00000-0000-4000-8000-000000000002'::uuid, 3, 'Mastercard', '4444', '11/27', 'active', null, null, false, interval '2 days'),
  ('a1e00000-0000-4000-8000-000000000003'::uuid, 22, 'Visa', '1881', '02/29', 'paused', current_date + 30, null, true, interval '9 days'),
  ('a1e00000-0000-4000-8000-000000000004'::uuid, 9, 'American Express', '0005', '06/28', 'active', null, null, false, interval '5 hours'),
  ('a1e00000-0000-4000-8000-000000000005'::uuid, 28, 'Discover', '1117', '01/27', 'cancelled', null, current_date + 12, true, interval '40 days'),
  ('a1e00000-0000-4000-8000-000000000006'::uuid, 1, 'Visa', '0077', '12/29', 'active', null, null, false, interval '3 days')
) as v (id, billing_day, brand, last4, exp, status, resumes_on, ends_on, opt_out, last_seen)
where n.id = v.id;

insert into public.preferences (user_id, autoplay_next, autoplay_previews, email_updates, personalized, maturity_rating)
values
  ('a1e00000-0000-4000-8000-000000000001', true, false, true, true, 'all'),
  ('a1e00000-0000-4000-8000-000000000002', true, true, false, true, 'all'),
  ('a1e00000-0000-4000-8000-000000000003', false, false, true, false, 'teen'),
  ('a1e00000-0000-4000-8000-000000000004', true, false, true, true, 'all'),
  ('a1e00000-0000-4000-8000-000000000005', true, false, false, false, 'all'),
  ('a1e00000-0000-4000-8000-000000000006', true, false, true, true, 'kids')
on conflict (user_id) do update set autoplay_next = excluded.autoplay_next, autoplay_previews = excluded.autoplay_previews,
  email_updates = excluded.email_updates, personalized = excluded.personalized, maturity_rating = excluded.maturity_rating;

-- Defaults everywhere except a few users who use the accessibility menu
insert into public.accessibility_settings (user_id, text_size, font, line_height, letter_spacing, contrast,
  saturation, highlight_links, strong_focus, stop_animations, captions, caption_size)
values
  ('a1e00000-0000-4000-8000-000000000001', 100, 'default', 'default', 'default', 'default', 'default', false, false, false, false, 'medium'),
  ('a1e00000-0000-4000-8000-000000000002', 130, 'readable', 'relaxed', 'default', 'high', 'default', true, true, false, true, 'large'),
  ('a1e00000-0000-4000-8000-000000000004', 115, 'dyslexia', 'loose', 'wide', 'default', 'low', false, false, true, true, 'xlarge');

-- Every account got its first profile from the sign-up trigger; Alex also has a Kids profile with its own watch list
-- (rows below without a profile_id go to the account's first profile). It's made a minute later: within one
-- transaction now() doesn't move, and a tie on created_at would make the first profile depend on the random ids.
insert into public.profiles (id, user_id, name, avatar, maturity_rating, created_at) values
  ('b0f00000-0000-4000-8000-000000000001', 'a1e00000-0000-4000-8000-000000000001', 'Kids', 'green', 'kids', now() + interval '1 minute');

insert into public.watch_list_tables (user_id, profile_id, title_id) values
  ('a1e00000-0000-4000-8000-000000000001', 'b0f00000-0000-4000-8000-000000000001', 'lantern-island');

insert into public.watch_list_tables (user_id, title_id, added_at) values
  ('a1e00000-0000-4000-8000-000000000001', 'behind-the-glass', now() - interval '3 days'),
  ('a1e00000-0000-4000-8000-000000000001', 'the-signal', now() - interval '1 day'),
  ('a1e00000-0000-4000-8000-000000000001', 'lantern-island', now() - interval '2 hours'),
  ('a1e00000-0000-4000-8000-000000000002', 'night-shift', now() - interval '10 days'),
  ('a1e00000-0000-4000-8000-000000000002', 'dead-reckoning', now() - interval '4 days'),
  ('a1e00000-0000-4000-8000-000000000004', 'after-dark', now() - interval '6 days'),
  ('a1e00000-0000-4000-8000-000000000006', 'lantern-island', now() - interval '1 day');

insert into public.favorites (user_id, title_id, added_at) values
  ('a1e00000-0000-4000-8000-000000000001', 'after-dark', now() - interval '20 days'),
  ('a1e00000-0000-4000-8000-000000000001', 'dead-reckoning', now() - interval '8 days'),
  ('a1e00000-0000-4000-8000-000000000002', 'behind-the-glass', now() - interval '30 days'),
  ('a1e00000-0000-4000-8000-000000000003', 'night-shift', now() - interval '15 days'),
  ('a1e00000-0000-4000-8000-000000000006', 'lantern-island', now() - interval '2 days');

-- The sample reviews from catalog.js, plus two ratings without a body
insert into public.review (user_id, title_id, rating, body, created_at) values
  ('a1e00000-0000-4000-8000-000000000002', 'behind-the-glass', 5, 'Every episode ends on a hook. Binged it in a weekend.', now() - interval '25 days'),
  ('a1e00000-0000-4000-8000-000000000003', 'night-shift', 4, 'Moody and clever. Season 2 is the best one.', now() - interval '14 days'),
  ('a1e00000-0000-4000-8000-000000000004', 'after-dark', 4, 'Simple premise, genuinely scary execution.', now() - interval '7 days'),
  ('a1e00000-0000-4000-8000-000000000005', 'the-veil', 3, 'Gorgeous to look at, a little slow in the middle.', now() - interval '60 days'),
  ('a1e00000-0000-4000-8000-000000000001', 'dead-reckoning', 5, 'Non-stop. The storm sequence is unreal.', now() - interval '8 days'),
  ('a1e00000-0000-4000-8000-000000000006', 'lantern-island', 5, 'Our whole family watches this together.', now() - interval '2 days'),
  ('a1e00000-0000-4000-8000-000000000001', 'the-signal', 4, null, now() - interval '1 day'),
  ('a1e00000-0000-4000-8000-000000000004', 'cold-open', 3, null, now() - interval '3 days');

insert into public.reminders (user_id, title_id, release_date) values
  ('a1e00000-0000-4000-8000-000000000001', 'cold-open', current_date + 7),
  ('a1e00000-0000-4000-8000-000000000002', 'static-hearts', current_date + 14),
  ('a1e00000-0000-4000-8000-000000000006', 'lantern-island', current_date + 3);

-- memory: fewest moves wins; trivia: most points wins
insert into public.game_scores (user_id, game, best_score) values
  ('a1e00000-0000-4000-8000-000000000001', 'memory', 14),
  ('a1e00000-0000-4000-8000-000000000001', 'trivia', 4),
  ('a1e00000-0000-4000-8000-000000000002', 'memory', 11),
  ('a1e00000-0000-4000-8000-000000000004', 'trivia', 5),
  ('a1e00000-0000-4000-8000-000000000006', 'memory', 19);

-- Jordan, Priya and Dana chose to show their scores on the game leaderboards (off by default)
update public.preferences set show_on_leaderboards = true
where user_id in ('a1e00000-0000-4000-8000-000000000002', 'a1e00000-0000-4000-8000-000000000004',
  'a1e00000-0000-4000-8000-000000000006');

-- Continue Watching: where Alex and Jordan stopped
insert into public.watch_progress (user_id, title_id, episode, position_seconds, progress_percent, updated_at) values
  ('a1e00000-0000-4000-8000-000000000001', 'night-shift', 2, 14.0, 38, now() - interval '1 day'),
  ('a1e00000-0000-4000-8000-000000000001', 'after-dark', 1, 21.5, 57, now() - interval '2 hours'),
  ('a1e00000-0000-4000-8000-000000000002', 'the-signal', 1, 30.0, 76, now() - interval '3 days');

insert into public.feedback (user_id, score, area, message, created_at) values
  ('a1e00000-0000-4000-8000-000000000001', 5, 'Playback', 'Captions are easy to read and the player is quick to start.', now() - interval '5 days'),
  ('a1e00000-0000-4000-8000-000000000003', 3, 'Browsing & search', 'I would like to filter search results by mood.', now() - interval '12 days'),
  ('a1e00000-0000-4000-8000-000000000004', 4, 'My List & Favorites', 'Please let me sort My List by date added.', now() - interval '2 days');

insert into public.tickets (user_id, ticket_number, issue_type, title_id, summary, steps, device, status, created_at) values
  ('a1e00000-0000-4000-8000-000000000001', 'NF-48210', 'Playback problem', 'the-signal', 'Video freezes at the 20 minute mark.',
    '1. Play The Signal  2. Skip to 20:00  3. Picture freezes, audio continues', 'iPhone 15, Safari', 'Open', now() - interval '2 days'),
  ('a1e00000-0000-4000-8000-000000000002', 'NF-48233', 'Captions or accessibility', 'behind-the-glass', 'Captions drift out of sync in episode 3.',
    null, 'Android TV', 'In progress', now() - interval '6 days'),
  ('a1e00000-0000-4000-8000-000000000005', 'NF-48302', 'Data removal request', null, 'Please delete all data for my cancelled account.',
    null, null, 'Open', now() - interval '1 day');

-- Dana is on the support team; she has answered Jordan's captions ticket
insert into public.staff (user_id) values ('a1e00000-0000-4000-8000-000000000006');
insert into public.ticket_replies (ticket_id, user_id, body)
  select id, 'a1e00000-0000-4000-8000-000000000006', 'Thanks for the report. We have reproduced the drift and a fix is on the way.'
  from public.tickets where ticket_number = 'NF-48233';

-- The code applied to each account (valid codes live in private.promotions); Dana and Jordan have one
insert into public.promo_codes (user_id, code, percent_off, plan, applied_at) values
  ('a1e00000-0000-4000-8000-000000000006', 'WELCOME50', 50, null, now() - interval '20 days'),
  ('a1e00000-0000-4000-8000-000000000002', 'FAMILY15', 15, 'premium', now() - interval '60 days');

insert into public.affiliates (id, user_id, referral_code, website_url, channels, accepted_terms, tier) values
  ('afa00000-0000-4000-8000-000000000001', 'a1e00000-0000-4000-8000-000000000002', 'JORDAN7Q2K', 'https://jordan-watches.example.com', 'Blog or website, YouTube', true, 'Pro'),
  ('afa00000-0000-4000-8000-000000000002', 'a1e00000-0000-4000-8000-000000000004', 'PRIYA3M8D', null, 'Instagram, TikTok', true, 'Starter');

insert into public.referrals (affiliate_id, kind, created_at)
select 'afa00000-0000-4000-8000-000000000001'::uuid, case when n % 3 = 0 then 'signup' else 'click' end, now() - n * interval '1 day'
from generate_series(1, 36) as n
union all
select 'afa00000-0000-4000-8000-000000000002'::uuid, case when n % 4 = 0 then 'signup' else 'click' end, now() - n * interval '1 day'
from generate_series(1, 8) as n;

-- Thumbs ratings (each account's first profile): Alex loves The Signal and isn't interested in Dead Reckoning
insert into public.title_reactions (user_id, title_id, reaction) values
  ('a1e00000-0000-4000-8000-000000000001', 'the-signal', 'love'),
  ('a1e00000-0000-4000-8000-000000000001', 'dead-reckoning', 'dislike'),
  ('a1e00000-0000-4000-8000-000000000002', 'night-shift', 'like');

-- Donations (normally written by the stripe-webhook function; these PaymentIntent ids are made up, not Stripe's):
-- Alex gave $5 and $25 (the first card was declined, then a retry went through); Jordan's $10 failed
insert into public.donations (user_id, amount, stripe_payment_intent_id, status, created_at) values
  ('a1e00000-0000-4000-8000-000000000001', 500, 'pi_seed_alex_0001', 'succeeded', now() - interval '40 days'),
  ('a1e00000-0000-4000-8000-000000000001', 2500, 'pi_seed_alex_0002', 'succeeded', now() - interval '3 days'),
  ('a1e00000-0000-4000-8000-000000000002', 1000, 'pi_seed_jordan_0001', 'failed', now() - interval '1 day');
