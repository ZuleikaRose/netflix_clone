-- Indexes for public.monthly_donations and donations.monthly_donation_id (migration ..._monthly_donations). Same rules
-- as 001: CONCURRENTLY, so apply with psql (autocommit) after the migrations:
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/non_transactional/012_monthly_donations_indexes.sql

-- At most one live monthly donation per member (the monthly-donation function checks first; this makes it certain).
-- It also covers the account key (account deletion) for the member's live row.
create unique index concurrently if not exists monthly_donations_one_live_idx on public.monthly_donations (user_id)
  where status in ('incomplete', 'active', 'past_due');
-- The account key for every row (account deletion), and the member's monthly donations newest first
create index concurrently if not exists monthly_donations_user_id_created_at_idx on public.monthly_donations (user_id, created_at desc);
-- The foreign key from each month's payment
create index concurrently if not exists donations_monthly_donation_id_idx on public.donations (monthly_donation_id);
