-- Indexes for the queries the app makes once users sign in with Supabase Auth. Same rules as 001: CONCURRENTLY, so
-- apply with psql (autocommit, one statement at a time) after the migrations:
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/non_transactional/002_query_indexes.sql
-- Each composite index leads with the foreign-key column, so it also serves the FK checks and cascades of the
-- single-column index it replaces; those (and two that unique constraints now duplicate) are dropped last.

-- Title page: newest reviews for one title
create index concurrently if not exists review_title_id_created_at_idx on public.review (title_id, created_at desc);
-- Affiliate dashboard: click and sign-up counts per affiliate
create index concurrently if not exists referrals_affiliate_id_kind_idx on public.referrals (affiliate_id, kind);
-- "Your reports" and feedback history, newest first
create index concurrently if not exists tickets_user_id_created_at_idx on public.tickets (user_id, created_at desc);
create index concurrently if not exists feedback_user_id_created_at_idx on public.feedback (user_id, created_at desc);
-- demo-account Edge Function: how many demo accounts were created in the last hour (rate cap)
create index concurrently if not exists netflix_tables_demo_created_at_idx on public.netflix_tables (created_at)
  where email like 'demo-%@example.com';

drop index concurrently if exists public.review_title_id_idx;
drop index concurrently if exists public.referrals_affiliate_id_idx;
drop index concurrently if exists public.tickets_user_id_idx;
drop index concurrently if exists public.feedback_user_id_idx;
-- Covered by the unique constraints affiliates_user_id_key and promo_codes_user_id_key
drop index concurrently if exists public.affiliates_user_id_idx;
drop index concurrently if exists public.promo_codes_user_id_idx;
