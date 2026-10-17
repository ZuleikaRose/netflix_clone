-- Index Advisor (Supabase's index_advisor extension, on hypopg): suggests missing indexes for slow queries in the
-- dashboard (Database → Query Performance) and through `select * from extensions.index_advisor('<query>')`.
-- It only creates hypothetical indexes in the calling session; real indexes still go in non_transactional/.
create extension if not exists hypopg with schema extensions;
create extension if not exists index_advisor with schema extensions;

-- For the developer in the dashboard / SQL editor. supabase_admin owns the function and grants it to PUBLIC, which
-- this can't undo; that's safe: the extensions schema isn't exposed by the REST API, and the function only runs
-- EXPLAIN with hypothetical indexes, using the caller's own privileges. This removes any grants postgres made.
revoke execute on function extensions.index_advisor(text) from public, anon, authenticated;
