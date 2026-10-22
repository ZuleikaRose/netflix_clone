-- Helpful votes on reviews and the staff donations view, run by `supabase test db` (pgTAP) against the seeded local
-- database. Everything runs in one transaction and is rolled back.
begin;
create extension if not exists pgtap with schema extensions;

select plan(11);

\set alex '''a1e00000-0000-4000-8000-000000000001'''
\set jordan '''a1e00000-0000-4000-8000-000000000002'''
\set staff '''a1e00000-0000-4000-8000-000000000006'''
select id as jordan_review from public.review where user_id = :jordan and body is not null order by created_at limit 1 \gset

set local role authenticated;
select set_config('request.jwt.claims', format('{"sub":%s,"role":"authenticated","aal":"aal1"}', to_json(:alex::text)), true);

-- Helpful votes -------------------------------------------------------------------------------------------------------
select lives_ok(format($$insert into public.review_helpful_votes (review_id) values (%L)$$, :'jordan_review'),
  'a member can mark another member''s review helpful');
select is((select helpful_count from public.review where id = :'jordan_review'), 1, 'the vote is counted on the review');
select throws_ok(format($$insert into public.review_helpful_votes (review_id) values (%L)$$, :'jordan_review'), '23505', null,
  'a member votes for a review once');
insert into public.review (title_id, rating, body) values ('the-veil', 4, 'My own take.');
select throws_ok($$insert into public.review_helpful_votes (review_id) select id from public.review where body = 'My own take.'$$,
  'P0001', 'You can''t mark your own review helpful.', 'members cannot vote for their own review');
update public.review set helpful_count = 50 where body = 'My own take.';
select is((select helpful_count from public.review where body = 'My own take.'), 0, 'authors cannot set the count');
select lives_ok(format($$delete from public.review_helpful_votes where review_id = %L$$, :'jordan_review'),
  'a member can take a vote back');
select is((select helpful_count from public.review where id = :'jordan_review'), 0, 'taking a vote back lowers the count');

select set_config('request.jwt.claims', format('{"sub":%s,"role":"authenticated","aal":"aal1"}', to_json(:jordan::text)), true);
insert into public.review_helpful_votes (review_id) select id from public.review where body = 'My own take.';
select is((select count(*) from public.review_helpful_votes), 1::bigint, 'members see only their own votes');

-- Donations on the support dashboard ----------------------------------------------------------------------------------
select throws_ok($$select * from public.staff_donation_months()$$, '42501', null, 'members cannot see donation totals');
select throws_ok($$select * from public.staff_recent_donations()$$, '42501', null, 'members cannot see other members'' donations');
select set_config('request.jwt.claims', format('{"sub":%s,"role":"authenticated","aal":"aal1"}', to_json(:staff::text)), true);
select lives_ok($$select * from public.staff_recent_donations('failed')$$, 'staff can list donations');

select * from finish();
rollback;
