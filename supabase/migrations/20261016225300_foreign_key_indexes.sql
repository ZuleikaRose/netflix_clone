-- Indexes on foreign keys not already covered by a unique constraint's leading column.
-- CONCURRENTLY cannot run inside a transaction: run these one statement at a time, not as one migration block.

create index concurrently if not exists watch_list_tables_title_id_idx on public.watch_list_tables (title_id);
create index concurrently if not exists favorites_title_id_idx on public.favorites (title_id);
create index concurrently if not exists tickets_user_id_idx on public.tickets (user_id);
create index concurrently if not exists tickets_title_id_idx on public.tickets (title_id);
create index concurrently if not exists review_user_id_idx on public.review (user_id);
create index concurrently if not exists review_title_id_idx on public.review (title_id);
create index concurrently if not exists feedback_user_id_idx on public.feedback (user_id);
create index concurrently if not exists promo_codes_user_id_idx on public.promo_codes (user_id);
create index concurrently if not exists reminders_title_id_idx on public.reminders (title_id);
create index concurrently if not exists affiliates_user_id_idx on public.affiliates (user_id);
create index concurrently if not exists referrals_affiliate_id_idx on public.referrals (affiliate_id);
