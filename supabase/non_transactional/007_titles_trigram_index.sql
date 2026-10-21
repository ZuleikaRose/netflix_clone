-- Trigram index for public.search_titles() (migration ..._better_search): its `<%` word-similarity test on the
-- lower-cased title can use this instead of comparing every title. Same rules as 001: CONCURRENTLY, so apply with
-- psql (autocommit) after the migrations:
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/non_transactional/007_titles_trigram_index.sql
create index concurrently if not exists titles_title_trgm_idx on public.titles using gin (lower(title) extensions.gin_trgm_ops);
