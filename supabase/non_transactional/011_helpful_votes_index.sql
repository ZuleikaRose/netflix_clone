-- Index for public.review_helpful_votes (migration ..._helpful_reviews). The primary key (review_id, user_id) covers the
-- review key; this covers the voter's account key (account deletion). Same rules as 001: CONCURRENTLY, so apply with
-- psql (autocommit) after the migrations:
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/non_transactional/011_helpful_votes_index.sql
create index concurrently if not exists review_helpful_votes_user_id_idx on public.review_helpful_votes (user_id);
