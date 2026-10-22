-- Index for public.screen_time (migration ..._screen_time). The primary key (profile_id, day) covers a profile's own
-- lookups; this covers the account key (account deletion). Same rules as 001: CONCURRENTLY, so apply with psql
-- (autocommit) after the migrations:
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/non_transactional/009_screen_time_index.sql
create index concurrently if not exists screen_time_user_id_idx on public.screen_time (user_id);
