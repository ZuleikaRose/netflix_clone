-- Thumbs ratings, Year in Review, profile locks and two-step sign-in, run by `supabase test db` (pgTAP) against the
-- seeded local database. Everything runs in one transaction and is rolled back.
begin;
create extension if not exists pgtap with schema extensions;

select plan(33);

\set alex '''a1e00000-0000-4000-8000-000000000001'''
\set jordan '''a1e00000-0000-4000-8000-000000000002'''
\set alex_session '''5e550000-0000-4000-8000-000000000001'''
\set jordan_session '''5e550000-0000-4000-8000-000000000002'''
select id as alex_profile from public.profiles where user_id = :alex and name = 'Alex' \gset
select id as jordan_profile from public.profiles where user_id = :jordan \gset

-- Seed users have no password; give Alex one, a signed-in device each, and something watched this year
update auth.users set encrypted_password = extensions.crypt('Brand-new-pass-42', extensions.gen_salt('bf')) where id = :alex;
insert into auth.sessions (id, user_id, created_at, updated_at, aal, user_agent) values
  (:alex_session, :alex, now() - interval '2 days', now(), 'aal1', 'Mozilla/5.0 (Windows NT 10.0) Chrome/140.0'),
  (:jordan_session, :jordan, now(), now(), 'aal1', 'Mozilla/5.0 (iPhone) Safari/605.1');
insert into public.viewing_history (user_id, profile_id, title_id, episode, watched_on) values
  (:alex, :'alex_profile', 'night-shift', 1, current_date),
  (:alex, :'alex_profile', 'night-shift', 2, current_date),
  (:alex, :'alex_profile', 'after-dark', 0, current_date - 1)
  on conflict do nothing;

set local role authenticated;
select set_config('request.jwt.claims',
  format('{"sub":%s,"role":"authenticated","aal":"aal1","session_id":%s}', to_json(:alex::text), to_json(:alex_session::text)), true);

-- Thumbs ratings ---------------------------------------------------------------------------------------------------
select lives_ok($$insert into public.title_reactions (title_id, reaction) values ('the-veil', 'love')$$,
  'a member can rate a title (on their first profile by default)');
select is((select profile_id from public.title_reactions where title_id = 'the-veil'), :'alex_profile'::uuid,
  'the rating belongs to the profile');
select throws_ok($$insert into public.title_reactions (title_id, reaction) values ('cold-open', 'meh')$$, '23514', null,
  'only Not for me, I like this and Love this! are ratings');
select throws_ok(format($$insert into public.title_reactions (profile_id, title_id, reaction) values (%L, 'cold-open', 'like')$$, :'jordan_profile'),
  '23503', null, 'a rating cannot go on another account''s profile');
select lives_ok($$update public.title_reactions set reaction = 'dislike' where title_id = 'the-veil'$$, 'a rating can change');
select is((select count(*) from public.title_reactions where user_id <> :alex), 0::bigint, 'a member sees only their own ratings');

-- Year in Review ---------------------------------------------------------------------------------------------------
select is(jsonb_array_length(public.year_in_review(:'alex_profile', extract(year from current_date)::integer) -> 'days'),
  (select count(distinct watched_on)::integer from public.viewing_history
    where profile_id = :'alex_profile' and extract(year from watched_on) = extract(year from current_date)),
  'Year in Review counts the days the profile watched something');
select ok(public.year_in_review(:'alex_profile', extract(year from current_date)::integer) -> 'titles'
    @> '[{"titleId": "night-shift", "episodes": [1, 2]}]'::jsonb,
  'Year in Review lists each title with the episodes watched');
select is(jsonb_array_length(public.year_in_review(:'alex_profile', extract(year from current_date)::integer) -> 'months'), 12,
  'Year in Review counts viewings for every month');
select is(public.year_in_review(:'jordan_profile', extract(year from current_date)::integer) -> 'days', '[]'::jsonb,
  'another account''s profile has nothing to show');

-- Profile locks ----------------------------------------------------------------------------------------------------
update public.profiles set locked = true where id = :'alex_profile';
select is((select locked from public.profiles where id = :'alex_profile'), false, 'members cannot lock a profile without a PIN');
select is(public.verify_account_password('not-it'), false, 'a wrong account password is refused');
select is(public.verify_account_password('Brand-new-pass-42'), true, 'the account password is recognised');
select throws_ok(format($$select public.set_profile_pin(%L, '1234', 'not-it')$$, :'alex_profile'), 'P0001',
  'Your password is incorrect.', 'setting a PIN needs the account password');
select throws_ok(format($$select public.set_profile_pin(%L, '12a4', 'Brand-new-pass-42')$$, :'alex_profile'), 'P0001',
  'A PIN is four digits.', 'a PIN is four digits');
select throws_ok(format($$select public.set_profile_pin(%L, '1234', 'Brand-new-pass-42')$$, :'jordan_profile'), 'P0001',
  'Profile not found.', 'a PIN cannot go on another account''s profile');
select lives_ok(format($$select public.set_profile_pin(%L, '1234', 'Brand-new-pass-42')$$, :'alex_profile'), 'a PIN can be set');
select is((select locked from public.profiles where id = :'alex_profile'), true, 'the profile is now locked');
select is(public.unlock_profile(:'alex_profile', '1234'), 'ok', 'the right PIN opens it');
select is(public.unlock_profile(:'alex_profile', '0000'), 'wrong', 'a wrong PIN is refused');
select is((select public.unlock_profile(:'alex_profile', '0000') from generate_series(1, 4) offset 3), 'locked',
  'five wrong PINs in a row lock the profile');
select is(public.unlock_profile(:'alex_profile', '1234'), 'locked', 'even the right PIN waits while it is locked');
select is(public.unlock_profile(:'jordan_profile', '1234'), 'wrong', 'another account''s profile cannot be opened');
select lives_ok(format($$select public.set_profile_pin(%L, null, 'Brand-new-pass-42')$$, :'alex_profile'), 'a PIN can be removed');
select is((select locked from public.profiles where id = :'alex_profile'), false, 'the profile is open again');

-- Signed-in devices ------------------------------------------------------------------------------------------------
select results_eq($$select id, current from public.my_sessions()$$, format($$values (%L::uuid, true)$$, :alex_session),
  'a member sees their own devices, with this one marked');
select is(public.end_session(:jordan_session), false, 'a member cannot sign out someone else''s device');
select is(public.end_session(:alex_session), false, 'the current device signs out with Sign out, not here');

-- Two-step sign-in -------------------------------------------------------------------------------------------------
reset role;
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at)
  values ('fac70000-0000-4000-8000-000000000001', :alex, 'pgtap', 'totp', 'verified', now(), now());
set local role authenticated;
select is(public.second_step_done(), false, 'with two-step sign-in on, a password-only session has not finished signing in');
select is((select count(*) from public.netflix_tables), 0::bigint, 'and reads none of the member''s data');
select is((select count(*) from public.my_sessions()), 0::bigint, 'or their devices');
select set_config('request.jwt.claims',
  format('{"sub":%s,"role":"authenticated","aal":"aal2","session_id":%s}', to_json(:alex::text), to_json(:alex_session::text)), true);
select is((select count(*) from public.netflix_tables), 1::bigint, 'after the code (aal2), the member''s data is back');
select set_config('request.jwt.claims', format('{"sub":%s,"role":"authenticated","aal":"aal1"}', to_json(:jordan::text)), true);
select is((select count(*) from public.netflix_tables), 1::bigint, 'members without two-step sign-in are not affected');
reset role;

select * from finish();
rollback;
