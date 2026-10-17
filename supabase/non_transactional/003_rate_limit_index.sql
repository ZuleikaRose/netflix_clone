-- Lookup index for public.hit_rate_limit(): hits for one key within a time window.
-- Same rules as 001: CONCURRENTLY, so apply with psql (autocommit) after the migrations.
create index concurrently if not exists rate_limit_hits_key_hit_at_idx on public.rate_limit_hits (key, hit_at);
