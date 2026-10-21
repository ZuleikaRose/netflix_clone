-- Indexes for ticket_replies (migration ..._support_dashboard). Same rules as 001: CONCURRENTLY, so apply with psql
-- (autocommit) after the migrations:
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/non_transactional/005_ticket_replies_indexes.sql

-- A ticket's conversation, oldest first (also covers the ticket_id foreign key)
create index concurrently if not exists ticket_replies_ticket_id_created_at_idx on public.ticket_replies (ticket_id, created_at);
-- Deleting an account removes its replies
create index concurrently if not exists ticket_replies_user_id_idx on public.ticket_replies (user_id);
