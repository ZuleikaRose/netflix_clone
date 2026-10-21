-- Indexes for public.title_reactions (migration ..._title_reactions). The primary key (profile_id, title_id) covers a
-- profile's own lookups; these cover the account key (account deletion) and the title key (catalog changes). Same
-- rules as 001: CONCURRENTLY, so apply with psql (autocommit) after the migrations:
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/non_transactional/008_title_reactions_indexes.sql
create index concurrently if not exists title_reactions_user_id_profile_id_idx on public.title_reactions (user_id, profile_id);
create index concurrently if not exists title_reactions_title_id_idx on public.title_reactions (title_id);
