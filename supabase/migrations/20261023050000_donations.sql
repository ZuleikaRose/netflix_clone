-- One-time donations through Stripe. The process-donation Edge Function creates a PaymentIntent for the signed-in
-- member (metadata.user_id); the stripe-webhook function records the outcome here with the service role when Stripe
-- reports it (payment_intent.succeeded / payment_intent.payment_failed). Members can only read their own rows: nothing
-- in the browser can add, change or remove a donation. Amounts are in cents (USD), at most $10,000.
-- Only the result is kept: no card details ever reach this database.

create table public.donations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.netflix_tables (id) on delete cascade,
  amount integer not null check (amount > 0 and amount <= 1000000),
  stripe_payment_intent_id text not null unique,
  status text not null check (status in ('succeeded', 'failed')),
  created_at timestamptz not null default now()
);

-- A member's donations, newest first; also the foreign-key index. The table is new and empty, so this doesn't need
-- CONCURRENTLY (non_transactional/) like the indexes added to tables that already hold rows.
create index donations_user_id_created_at_idx on public.donations (user_id, created_at desc);

grant select on public.donations to authenticated;
-- The webhook only reads, records and upgrades a failed donation to succeeded: no deletes, even with the service role
revoke all on public.donations from service_role;
grant select, insert, update on public.donations to service_role;
alter table public.donations enable row level security;

create policy "Users read their own rows" on public.donations
  for select to authenticated using ((select auth.uid()) = user_id);

-- Like every other table with RLS (migration ..._two_step_sign_in)
create policy "Two-step sign-in finished" on public.donations as restrictive for all to authenticated
  using ((select public.second_step_done())) with check ((select public.second_step_done()));
