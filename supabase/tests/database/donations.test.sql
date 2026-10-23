-- Donations (migration ..._donations), run by `supabase test db` (pgTAP) against the seeded local database. Only the
-- service role (the stripe-webhook function) records donations; members read their own. Rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;

select plan(20);

\set alex '''a1e00000-0000-4000-8000-000000000001'''
\set jordan '''a1e00000-0000-4000-8000-000000000002'''

-- The table ---------------------------------------------------------------------------------------------------------
select has_table('public', 'donations', 'donations has a table');
select columns_are('public', 'donations',
  array['id', 'user_id', 'amount', 'stripe_payment_intent_id', 'status', 'created_at', 'monthly_donation_id'], 'donations has its columns');
select col_is_unique('public', 'donations', 'stripe_payment_intent_id', 'one row per Stripe PaymentIntent');
select ok((select relrowsecurity from pg_class where oid = 'public.donations'::regclass), 'donations has RLS on');
select policies_are('public', 'donations', array['Users read their own rows', 'Two-step sign-in finished'],
  'members can only read: there is no insert, update or delete policy');

-- The webhook (service role) -----------------------------------------------------------------------------------------
set local role service_role;
select lives_ok(format($$insert into public.donations (user_id, amount, stripe_payment_intent_id, status) values
    (%L, 500, 'pi_pgtap_alex', 'succeeded'), (%L, 2500, 'pi_pgtap_jordan', 'failed')$$, :alex, :jordan),
  'the webhook records donations');
select throws_ok(format($$insert into public.donations (user_id, amount, stripe_payment_intent_id, status)
    values (%L, 0, 'pi_pgtap_zero', 'succeeded')$$, :alex), '23514', null, 'a donation is more than nothing');
select throws_ok(format($$insert into public.donations (user_id, amount, stripe_payment_intent_id, status)
    values (%L, 1000001, 'pi_pgtap_big', 'succeeded')$$, :alex), '23514', null, 'a donation is at most $10,000');
select throws_ok(format($$insert into public.donations (user_id, amount, stripe_payment_intent_id, status)
    values (%L, 100, 'pi_pgtap_pending', 'pending')$$, :alex), '23514', null, 'a donation either succeeded or failed');
select throws_ok(format($$insert into public.donations (user_id, amount, stripe_payment_intent_id, status)
    values (%L, 500, 'pi_pgtap_alex', 'failed')$$, :alex), '23505', null, 'a PaymentIntent is recorded once');
select lives_ok($$update public.donations set status = 'succeeded' where stripe_payment_intent_id = 'pi_pgtap_jordan'$$,
  'a failed donation can become a success (the card was retried)');
select throws_ok($$delete from public.donations where stripe_payment_intent_id = 'pi_pgtap_jordan'$$, '42501', null,
  'not even the webhook deletes donations');
reset role;

-- Members -----------------------------------------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', format('{"sub":%s,"role":"authenticated","aal":"aal1"}', to_json(:alex::text)), true);
select is((select count(*) from public.donations where user_id <> :alex), 0::bigint, 'a member sees only their own donations');
select ok(exists (select 1 from public.donations where stripe_payment_intent_id = 'pi_pgtap_alex'), 'including the new one');
select throws_ok(format($$insert into public.donations (user_id, amount, stripe_payment_intent_id, status)
    values (%L, 100, 'pi_pgtap_fake', 'succeeded')$$, :alex), '42501', null, 'members cannot record a donation themselves');
select throws_ok($$update public.donations set amount = 1000000 where stripe_payment_intent_id = 'pi_pgtap_alex'$$, '42501', null,
  'members cannot change a donation');
select throws_ok($$delete from public.donations where stripe_payment_intent_id = 'pi_pgtap_alex'$$, '42501', null,
  'members cannot remove a donation');

reset role;
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at)
  values ('fac70000-0000-4000-8000-0000000000d1', :alex, 'pgtap', 'totp', 'verified', now(), now());
set local role authenticated;
select is((select count(*) from public.donations), 0::bigint, 'with two-step sign-in on, an aal1 session sees no donations');
select set_config('request.jwt.claims', format('{"sub":%s,"role":"authenticated","aal":"aal2"}', to_json(:alex::text)), true);
select ok(exists (select 1 from public.donations where stripe_payment_intent_id = 'pi_pgtap_alex'), 'after the code they are back');
reset role;

-- Signed-out visitors -----------------------------------------------------------------------------------------------
set local role anon;
select throws_ok('select 1 from public.donations', '42501', null, 'anon cannot read donations');
reset role;

select * from finish();
rollback;
