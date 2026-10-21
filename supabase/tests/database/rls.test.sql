-- Access rules, triggers and indexes, run by `supabase test db` (pgTAP) against a local database built from
-- migrations/, non_transactional/ and seeds/. Everything runs in one transaction and is rolled back.
begin;
create extension if not exists pgtap with schema extensions;

select plan(82);

-- Seed users
\set alex '''a1e00000-0000-4000-8000-000000000001'''
\set jordan '''a1e00000-0000-4000-8000-000000000002'''
\set dana '''a1e00000-0000-4000-8000-000000000006'''
-- Each account's first profile (made by the sign-up trigger)
select id as alex_profile from public.profiles where user_id = :alex and name = 'Alex' \gset
select id as jordan_profile from public.profiles where user_id = :jordan \gset
select id as jordan_ticket from public.tickets where ticket_number = 'NF-48233' \gset

-- Signed-out visitors ----------------------------------------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select is((select count(*) from public.titles), 9::bigint, 'anon can browse the catalog');
select ok((select count(*) from public.review where body is not null) > 0, 'anon can read reviews');
select throws_ok('select 1 from public.netflix_tables', '42501', null, 'anon cannot read accounts');
select throws_ok('select 1 from public.watch_list_tables', '42501', null, 'anon cannot read watch lists');
select throws_ok($$insert into public.titles (id, title, type) values ('x', 'x', 'movie')$$, '42501', null, 'anon cannot add titles');
select throws_ok($$select public.hit_rate_limit('x', 1, 60)$$, '42501', null, 'anon cannot use the rate limiter');
select throws_ok('select 1 from public.rate_limit_hits', '42501', null, 'anon cannot read rate-limit hits');
select throws_ok('select 1 from public.promotions', '42501', null, 'anon cannot read the valid promo codes');
select is((select count(*) from public.titles where source = 'catalog'), 9::bigint, 'catalog titles are marked as the catalog');
select lives_ok('select 1 from public.tmdb_titles', 'anon can read saved TMDB titles');
select throws_ok($$insert into public.tmdb_titles (title_id, tmdb_id, media_type, tmdb_url) values ('after-dark', 1, 'movie', 'x')$$,
  '42501', null, 'anon cannot add saved TMDB titles');
select throws_ok('select 1 from public.watch_progress', '42501', null, 'anon cannot read watch progress');
select throws_ok('select 1 from public.profiles', '42501', null, 'anon cannot read profiles');
select throws_ok('select 1 from public.tmdb_certifications', '42501', null, 'only the tmdb function reads TMDB certifications');
select results_eq($$select player, best_score from public.game_leaderboard('memory')$$,
  $$values ('Jordan'::varchar, 11), ('Dana'::varchar, 19)$$, 'leaderboards list only members who opted in, fewest moves first');

-- Alex, signed in --------------------------------------------------------------------------------------------------
reset role;
set local role authenticated;
select set_config('request.jwt.claims', format('{"sub":%s,"role":"authenticated"}', to_json(:alex::text)), true);

select is((select count(*) from public.netflix_tables), 1::bigint, 'a user sees only their own account');
select is((select count(*) from public.watch_list_tables), 4::bigint, 'a user sees only their own watch lists (all profiles)');
select is((select count(*) from public.profiles), 2::bigint, 'a user sees only their own profiles');
select is((select count(*) from public.watch_list_tables where profile_id = :'alex_profile'), 3::bigint,
  'each profile has its own watch list');
select lives_ok($$insert into public.watch_list_tables (profile_id, title_id) values ('b0f00000-0000-4000-8000-000000000001', 'the-signal')$$,
  'two profiles can save the same title');
select throws_ok(format($$insert into public.watch_list_tables (profile_id, title_id) values (%L, 'the-veil')$$, :'jordan_profile'),
  '23503', null, 'a row cannot point at another account''s profile');
select throws_ok($$insert into public.profiles (name) values ('Kids')$$, '23505', null, 'profile names are unique per account');
select lives_ok($$insert into public.profiles (name) values ('Guest 1'), ('Guest 2'), ('Guest 3')$$, 'an account can have five profiles');
select throws_ok($$insert into public.profiles (name) values ('Guest 4')$$, 'P0001', 'An account can have at most 5 profiles.',
  'but no more than five');
select is((select count(*) from public.tickets), 1::bigint, 'a user sees only their own tickets');
select is((select count(*) from public.referrals), 0::bigint, 'a non-affiliate sees no referrals');
select lives_ok($$insert into public.favorites (title_id) values ('the-veil')$$, 'user_id defaults to the signed-in user');
select throws_ok(format($$insert into public.favorites (user_id, title_id) values (%L, 'the-veil')$$, :jordan::text),
  '42501', null, 'a user cannot add rows for someone else');
-- results_eq runs the query on its own: a data-modifying WITH must be at the top level, not inside a subquery
select results_eq(
  format($$with u as (update public.watch_list_tables set title_id = 'cold-open' where user_id = %L returning 1) select count(*) from u$$, :jordan::text),
  $$values (0::bigint)$$, 'a user cannot change someone else''s rows');
select throws_ok($$insert into public.titles (id, title, type, source) values ('tmdb-movie-1', 'x', 'movie', 'tmdb')$$,
  '42501', null, 'a user cannot add TMDB titles directly (only the tmdb function can)');
select lives_ok($$update public.preferences set player_volume = 60$$, 'a user can save their player volume');
select throws_ok($$update public.preferences set player_volume = 150$$, '23514', null, 'player volume stays between 0 and 100');
select is((select count(*) from public.watch_progress), 2::bigint, 'a user sees only their own watch progress');
select lives_ok($$insert into public.watch_progress (title_id, position_seconds, progress_percent) values ('the-veil', 9, 20)$$,
  'a user can save where they stopped');
select throws_ok($$update public.watch_progress set progress_percent = 120$$, '23514', null, 'progress stays between 0 and 100');
select is((select count(*) from public.game_leaderboard('memory', :'alex_profile') where is_me), 0::bigint, 'leaderboards are opt-in');
update public.preferences set show_on_leaderboards = true;
select results_eq(format($$select place, player from public.game_leaderboard('memory', %L) where is_me$$, :'alex_profile'),
  $$values (2, 'Alex'::varchar)$$, 'after opting in, a member shows by first name in their place');
select results_eq(
  format($$with u as (update public.netflix_tables set plan = 'premium' where id = %L returning 1) select count(*) from u$$, :alex::text),
  $$values (1::bigint)$$, 'a user can change their own plan');
select throws_ok($$update public.netflix_tables set email = 'evil@example.com'$$, '42501', null, 'email is owned by Supabase Auth');
select throws_ok($$update public.tickets set status = 'Closed'$$, '42501', null, 'tickets cannot be edited after submitting');
select throws_ok($$insert into public.promo_codes (user_id, code) values (auth.uid(), 'FREE100')$$, '42501', null,
  'promo codes are applied only by the apply-promo function');
select throws_ok('select 1 from public.promotions', '42501', null, 'signed-in users cannot read the valid promo codes');

insert into public.review (title_id, rating, body, author_name) values ('after-dark', 2, 'pgTAP review', 'Somebody Else');
select is((select author_name from public.review where body = 'pgTAP review'), 'Alex'::varchar, 'reviews carry the real author''s name');
insert into public.tickets (issue_type, summary) values ('App bug', 'pgTAP ticket');
select matches((select ticket_number from public.tickets where summary = 'pgTAP ticket'), '^NF-[0-9]+$', 'the database numbers tickets');

-- Notifications: a profile records when it last opened them
update public.profiles set notifications_seen_at = '2030-01-01' where id = :'alex_profile';
select is((select notifications_seen_at from public.profiles where id = :'alex_profile'), '2030-01-01'::timestamptz,
  'a member records when a profile last saw its notifications');

-- Viewing history: recorded per profile, and not at all while paused
insert into public.viewing_history (title_id, episode, watched_on) values ('after-dark', 0, '2026-10-01');
select is((select profile_id from public.viewing_history where title_id = 'after-dark'), :'alex_profile'::uuid,
  'history without a profile goes to the account''s first profile');
update public.preferences set keep_viewing_history = false where user_id = :alex;
insert into public.viewing_history (title_id, episode, watched_on) values ('the-signal', 0, '2026-10-01');
select is((select count(*) from public.viewing_history where title_id = 'the-signal'), 0::bigint,
  'a paused history records nothing');
update public.preferences set keep_viewing_history = true, history_retention_days = 90 where user_id = :alex;

-- Support: Alex isn't staff
select is((select count(*) from public.staff), 0::bigint, 'a member who isn''t staff has no staff row');
select throws_ok('select * from public.staff_tickets()', '42501', null, 'members who aren''t staff can''t read the ticket queue');
select throws_ok($$select public.staff_set_ticket_status((select id from public.tickets where ticket_number = 'NF-48210'), 'Resolved')$$,
  '42501', null, 'members who aren''t staff can''t change a ticket''s status');
insert into public.ticket_replies (ticket_id, body, from_staff, author_name)
  select id, 'pgTAP member reply', true, 'Support team' from public.tickets where ticket_number = 'NF-48210';
select is((select (from_staff, author_name)::text from public.ticket_replies where body = 'pgTAP member reply'), '(f,Alex)',
  'a member''s reply can''t pass as staff');
select throws_ok(format('insert into public.ticket_replies (ticket_id, body) values (%L, %L)', :'jordan_ticket', 'pgTAP stray reply'),
  '42501', null,
  'members can''t reply on tickets that aren''t theirs');
select is((select count(*) from public.ticket_replies), 1::bigint, 'members see replies only on their own tickets');

-- Jordan, an affiliate ---------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', format('{"sub":%s,"role":"authenticated"}', to_json(:jordan::text)), true);
select ok((select count(*) from public.referrals) > 0, 'an affiliate sees their own referrals');
select throws_ok(format('delete from public.profiles where id = %L', :'jordan_profile'), 'P0001',
  'An account needs at least one profile.', 'an account keeps at least one profile');
select is((select count(*) from public.referrals where affiliate_id = 'afa00000-0000-4000-8000-000000000002'), 0::bigint,
  'an affiliate cannot see another affiliate''s referrals');
select is((select count(*) from public.viewing_history), 0::bigint, 'members can''t see each other''s viewing history');

-- Dana, on the support team ------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', format('{"sub":%s,"role":"authenticated"}', to_json(:dana::text)), true);
select ok((select count(*) from public.staff_tickets()) >= 4, 'staff see every member''s tickets');
select ok((select bool_and(status = 'Open') from public.staff_tickets('Open')), 'the queue filters by status');
select is((select member_name from public.staff_tickets() where ticket_number = 'NF-48233'), 'Jordan'::varchar,
  'the queue names the member');
select lives_ok($$select public.staff_set_ticket_status((select id from public.staff_tickets() where ticket_number = 'NF-48210'), 'In progress')$$,
  'staff change a ticket''s status');
select throws_ok($$select public.staff_set_ticket_status((select id from public.staff_tickets() where ticket_number = 'NF-48210'), 'Closed')$$,
  '23514', null, 'a ticket''s status must be Open, In progress or Resolved');
insert into public.ticket_replies (ticket_id, body)
  select id, 'pgTAP staff reply' from public.staff_tickets() where ticket_number = 'NF-48210';
select is((select (from_staff, author_name)::text from public.ticket_replies where body = 'pgTAP staff reply'), '(t,"Support team")',
  'staff replies are marked as the support team');
select set_config('request.jwt.claims', format('{"sub":%s,"role":"authenticated"}', to_json(:alex::text)), true);
select is((select status from public.tickets where ticket_number = 'NF-48210'), 'In progress'::varchar,
  'the member sees the new status');

-- Sign-up trigger and cleanup job (as the auth service and cron would run them) ------------------------------------
reset role;
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('00000000-0000-0000-0000-000000000000', 'b0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
    'Robin.Test@example.com', '', '{}', '{"name":"Robin","plan":"basic","referral_code":"jordan7q2k"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'b0000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
    'demo-expired@example.com', '', '{"demo":true}', '{"name":"Alex"}', now() - interval '25 hours', now(), '', '', '', '');

select is((select email || ' ' || name || ' ' || plan || ' ' || card_last4 from public.netflix_tables where id = 'b0000000-0000-4000-8000-000000000001'),
  'robin.test@example.com Robin basic 4242', 'sign-up creates the account with lower-cased email and defaults');
select is((select count(*) from public.preferences where user_id = 'b0000000-0000-4000-8000-000000000001'), 1::bigint,
  'sign-up creates the preferences row');
select is((select name from public.profiles where user_id = 'b0000000-0000-4000-8000-000000000001'), 'Robin'::varchar,
  'sign-up creates a first profile named after the member');
select is((select count(*) from public.referrals r join public.affiliates a on a.id = r.affiliate_id where a.referral_code = 'JORDAN7Q2K' and r.kind = 'signup'),
  13::bigint, 'a referral code at sign-up counts for the affiliate');
update auth.users set email = 'robin.new@example.com', last_sign_in_at = now() where id = 'b0000000-0000-4000-8000-000000000001';
select is((select email from public.netflix_tables where id = 'b0000000-0000-4000-8000-000000000001'), 'robin.new@example.com'::varchar,
  'email changes in Supabase Auth reach the account');
select ok(private.delete_expired_demo_accounts() >= 1, 'the cleanup job reports what it deleted');
select is((select count(*) from auth.users where id = 'b0000000-0000-4000-8000-000000000002'), 0::bigint,
  'the cleanup job deletes demo accounts older than 24 hours');
select is((select count(*) from public.netflix_tables where id = 'b0000000-0000-4000-8000-000000000001'), 1::bigint,
  'the cleanup job keeps ordinary accounts');

-- History older than the member's limit (Alex keeps 90 days) goes in the nightly job
update public.viewing_history set watched_at = now() - interval '100 days' where title_id = 'after-dark';
insert into public.viewing_history (user_id, profile_id, title_id, watched_on)
  values (:jordan, :'jordan_profile', 'after-dark', current_date - 200);
select ok(private.delete_old_viewing_history() >= 1, 'the history job reports what it deleted');
select is((select count(*) from public.viewing_history where user_id = :alex), 0::bigint, 'history past the member''s limit is deleted');
select is((select count(*) from public.viewing_history where user_id = :jordan), 1::bigint,
  'history is kept for members who chose no limit');

-- Rate limiter (as the Edge Functions call it, with the secret key) -------------------------------------------------
set local role service_role;
select ok(public.hit_rate_limit('pgtap:203.0.113.7', 2, 60) and public.hit_rate_limit('pgtap:203.0.113.7', 2, 60),
  'the rate limiter allows hits up to the limit');
select is(public.hit_rate_limit('pgtap:203.0.113.7', 2, 60), false, 'the rate limiter refuses the next hit in the window');
select is(public.hit_rate_limit('pgtap:198.51.100.9', 2, 60), true, 'other keys have their own limit');
reset role;

-- Indexes ----------------------------------------------------------------------------------------------------------
select has_index('public', 'review', 'review_title_id_created_at_idx', 'title page reviews are indexed');
select has_index('public', 'referrals', 'referrals_affiliate_id_kind_idx', 'affiliate counts are indexed');
select has_index('public', 'watch_list_tables', 'watch_list_tables_title_id_idx', 'watch list title FK is indexed');
select has_extension('extensions', 'index_advisor', 'Index Advisor is installed');

select * from finish();
rollback;
