-- The per-profile unique keys (profile_id, title_id / game) replaced the (user_id, …) ones, which had covered the
-- user_id foreign keys. One (user_id, profile_id) index per table covers both the user_id key and the composite
-- (profile_id, user_id) → profiles key, so deleting a profile or an account doesn't scan the table. Same rules as 001: CONCURRENTLY, so apply with psql
-- (autocommit) after the migrations:
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/non_transactional/006_profile_fk_indexes.sql
-- The performance advisor still lists the composite keys as unindexed because the column order differs; the FK check
-- (profile_id = … and user_id = …) is an index-only scan on these, so a second index per table would only cost writes.
create index concurrently if not exists watch_list_tables_user_id_profile_id_idx on public.watch_list_tables (user_id, profile_id);
create index concurrently if not exists favorites_user_id_profile_id_idx on public.favorites (user_id, profile_id);
create index concurrently if not exists reminders_user_id_profile_id_idx on public.reminders (user_id, profile_id);
create index concurrently if not exists watch_progress_user_id_profile_id_idx on public.watch_progress (user_id, profile_id);
create index concurrently if not exists game_scores_user_id_profile_id_idx on public.game_scores (user_id, profile_id);
