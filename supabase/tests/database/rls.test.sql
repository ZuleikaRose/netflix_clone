-- Access rules, triggers and indexes, run by `supabase test db` (pgTAP) against a local database built from
-- migrations/, non_transactional/ and seeds/. Everything runs in one transaction and is rolled back.
begin;
create extension if not exists pgtap with schema extensions;

select plan(32);

-- Seed users
\set alex '''a1e00000-0000-4000-8000-000000000001'''
\set jordan '''a1e00000-0000-4000-8000-000000000002'''

-- Signed-out visitors ----------------------------------------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select is((select count(*) from public.titles), 9::bigint, 'anon can browse the catalog');
select ok((select count(*) from public.review where body is not null) > 0, 'anon can read reviews');
select throws_ok('select 1 from public.netflix_tables', '42501', null, 'anon cannot read accounts');
select throws_ok('select 1 from public.watch_list_tables', '42501', null, 'anon cannot read watch lists');
select throws_ok($$insert into public.titles (id, title, type) values ('x', 'x', 'movie')$$, '42501', null, 'anon cannot add titles');
select throws_ok('select 1 from public.promotions', '42501', null, 'anon cannot read the valid promo codes');

-- Alex, signed in --------------------------------------------------------------------------------------------------
reset role;
set local role authenticated;
select set_config('request.jwt.claims', format('{"sub":%s,"role":"authenticated"}', to_json(:alex::text)), true);

select is((select count(*) from public.netflix_tables), 1::bigint, 'a user sees only their own account');
select is((select count(*) from public.watch_list_tables), 3::bigint, 'a user sees only their own watch list');
select is((select count(*) from public.tickets), 1::bigint, 'a user sees only their own tickets');
select is((select count(*) from public.referrals), 0::bigint, 'a non-affiliate sees no referrals');
select lives_ok($$insert into public.favorites (title_id) values ('the-veil')$$, 'user_id defaults to the signed-in user');
select throws_ok(format($$insert into public.favorites (user_id, title_id) values (%L, 'the-veil')$$, :jordan::text),
  '42501', null, 'a user cannot add rows for someone else');
-- results_eq runs the query on its own: a data-modifying WITH must be at the top level, not inside a subquery
select results_eq(
  format($$with u as (update public.watch_list_tables set title_id = 'cold-open' where user_id = %L returning 1) select count(*) from u$$, :jordan::text),
  $$values (0::bigint)$$, 'a user cannot change someone else''s rows');
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

-- Jordan, an affiliate ---------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', format('{"sub":%s,"role":"authenticated"}', to_json(:jordan::text)), true);
select ok((select count(*) from public.referrals) > 0, 'an affiliate sees their own referrals');
select is((select count(*) from public.referrals where affiliate_id = 'afa00000-0000-4000-8000-000000000002'), 0::bigint,
  'an affiliate cannot see another affiliate''s referrals');

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

-- Indexes ----------------------------------------------------------------------------------------------------------
select has_index('public', 'review', 'review_title_id_created_at_idx', 'title page reviews are indexed');
select has_index('public', 'referrals', 'referrals_affiliate_id_kind_idx', 'affiliate counts are indexed');
select has_index('public', 'watch_list_tables', 'watch_list_tables_title_id_idx', 'watch list title FK is indexed');

select * from finish();
rollback;
