-- Screen-time limits, the caption language and reported reviews, run by `supabase test db` (pgTAP) against the seeded
-- local database. Everything runs in one transaction and is rolled back.
begin;
create extension if not exists pgtap with schema extensions;

select plan(25);

\set alex '''a1e00000-0000-4000-8000-000000000001'''
\set jordan '''a1e00000-0000-4000-8000-000000000002'''
select id as alex_profile from public.profiles where user_id = :alex and name = 'Alex' \gset
select id as jordan_profile from public.profiles where user_id = :jordan \gset
\set staff '''a1e00000-0000-4000-8000-000000000006'''
select id as jordan_review from public.review where user_id = :jordan and body is not null order by created_at limit 1 \gset

-- Seed users have no password; give Alex one
update auth.users set encrypted_password = extensions.crypt('Brand-new-pass-42', extensions.gen_salt('bf')) where id = :alex;

-- Caption language ------------------------------------------------------------------------------------------------
select col_default_is('public', 'accessibility_settings', 'caption_language', 'en'::character varying,
  'captions are in English unless a member picks Spanish');
select col_has_check('public', 'accessibility_settings', 'caption_language', 'only English and Spanish captions exist');

set local role authenticated;
select set_config('request.jwt.claims', format('{"sub":%s,"role":"authenticated","aal":"aal1"}', to_json(:alex::text)), true);

-- Screen-time limits ------------------------------------------------------------------------------------------------
update public.profiles set daily_limit_minutes = 30 where id = :'alex_profile';
select is((select daily_limit_minutes from public.profiles where id = :'alex_profile'), null::smallint,
  'members cannot set a daily limit without the account password');
select throws_ok(format($$select public.set_screen_time_limit(%L, 60, 'not-it')$$, :'alex_profile'), 'P0001',
  'Your password is incorrect.', 'a wrong account password is refused');
select throws_ok(format($$select public.set_screen_time_limit(%L, 45, 'Brand-new-pass-42')$$, :'alex_profile'), 'P0001',
  'Choose a daily limit from the list.', 'only the listed limits are allowed');
select throws_ok(format($$select public.set_screen_time_limit(%L, 60, 'Brand-new-pass-42')$$, :'jordan_profile'), 'P0001',
  'Profile not found.', 'another account''s profile cannot be limited');
select lives_ok(format($$select public.set_screen_time_limit(%L, 60, 'Brand-new-pass-42')$$, :'alex_profile'),
  'the account password sets a daily limit');
select is((select daily_limit_minutes from public.profiles where id = :'alex_profile'), 60::smallint, 'the limit is saved');

select is((public.add_screen_time(:'alex_profile', current_date, 45)).seconds, 45, 'watched time is counted');
select is((public.add_screen_time(:'alex_profile', current_date, 15)).seconds, 60, 'and adds up over the day');
select throws_ok(format($$select public.add_screen_time(%L, current_date, 600)$$, :'alex_profile'), 'P0001',
  'Report between 1 and 60 seconds at a time.', 'time is reported in small steps');
select throws_ok(format($$select public.add_screen_time(%L, current_date - 5, 10)$$, :'alex_profile'), 'P0001',
  'That isn''t today.', 'only today''s time can be counted');
select throws_ok($$update public.screen_time set seconds = 0$$, '42501', null,
  'members cannot reset the time watched');
select throws_ok(format($$select public.add_extra_screen_time(%L, current_date, 30, 'not-it')$$, :'alex_profile'), 'P0001',
  'Your password is incorrect.', 'extra time needs the account password');
select is((public.add_extra_screen_time(:'alex_profile', current_date, 30, 'Brand-new-pass-42')).extra_seconds, 1800,
  'a grown-up can allow 30 more minutes today');

select set_config('request.jwt.claims', format('{"sub":%s,"role":"authenticated","aal":"aal1"}', to_json(:jordan::text)), true);
select is((select count(*) from public.screen_time), 0::bigint, 'members see only their own screen time');

-- Reported reviews --------------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', format('{"sub":%s,"role":"authenticated","aal":"aal1"}', to_json(:alex::text)), true);
select lives_ok(format($$insert into public.review_reports (review_id, reason, details) values (%L, 'spoilers', ' gives it away ')$$, :'jordan_review'),
  'a member can report another member''s review');
select results_eq($$select review_author, status, details from public.review_reports$$,
  $$values ('Jordan'::varchar, 'Open'::varchar, 'gives it away'::text)$$,
  'the report keeps a copy of the review and starts open');
select throws_ok(format($$insert into public.review_reports (review_id, reason) values (%L, 'spam')$$, :'jordan_review'), '23505', null,
  'a member reports a review once');
insert into public.review (title_id, rating, body) values ('the-veil', 4, 'My own take.');
select throws_ok($$insert into public.review_reports (review_id, reason) select id, 'spam' from public.review where body = 'My own take.'$$,
  'P0001', 'You can''t report your own review.', 'members cannot report their own review');
select throws_ok($$update public.review_reports set status = 'Kept'$$, '42501', null, 'members cannot settle a report');
select throws_ok($$select * from public.staff_review_reports()$$, '42501', null, 'only staff see reported reviews');

select set_config('request.jwt.claims', format('{"sub":%s,"role":"authenticated","aal":"aal1"}', to_json(:staff::text)), true);
select is((select count(*) from public.staff_review_reports() where review_id = :'jordan_review'), 1::bigint,
  'staff see the open report');
select lives_ok(format($$select public.staff_resolve_review(%L, true)$$, :'jordan_review'), 'staff can remove the review');
select is((select count(*) from public.review where id = :'jordan_review'), 0::bigint, 'the review is gone');

select * from finish();
rollback;
