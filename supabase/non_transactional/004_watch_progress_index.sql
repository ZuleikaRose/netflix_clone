-- The foreign-key index for watch_progress (migration ..._watch_progress_and_leaderboards). Same rules as 001:
-- CONCURRENTLY, so apply with psql (autocommit) after the migrations:
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/non_transactional/004_watch_progress_index.sql

create index concurrently if not exists watch_progress_title_id_idx on public.watch_progress (title_id);
