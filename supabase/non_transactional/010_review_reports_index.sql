-- Index for public.review_reports (migration ..._review_reports). The unique (review_id, user_id) constraint covers the
-- review key; this covers the reporter's account key (account deletion). Same rules as 001: CONCURRENTLY, so apply
-- with psql (autocommit) after the migrations:
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/non_transactional/010_review_reports_index.sql
create index concurrently if not exists review_reports_user_id_idx on public.review_reports (user_id);
