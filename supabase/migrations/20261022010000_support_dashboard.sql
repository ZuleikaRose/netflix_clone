-- Support dashboard: staff see every ticket, change its status and reply; members see the replies under their own
-- reports and can answer. Staff are marked in public.staff, which only the dashboard owner (SQL editor) changes.

-- 1. Who is staff. A member can read only their own row (so the app knows whether to show the dashboard).
create table public.staff (
  user_id uuid primary key references public.netflix_tables (id) on delete cascade,
  added_at timestamptz not null default now()
);
grant select on public.staff to authenticated;
alter table public.staff enable row level security;
create policy "Users read their own row" on public.staff
  for select to authenticated using ((select auth.uid()) = user_id);

-- 2. Ticket statuses the dashboard can set
alter table public.tickets
  add constraint tickets_status_check check (status in ('Open', 'In progress', 'Resolved'));

-- 3. The conversation on a ticket. from_staff and author_name are set by a trigger, so neither can be faked.
create table public.ticket_replies (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.netflix_tables (id) on delete cascade,
  from_staff boolean not null default false,
  author_name varchar not null default '',
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
grant select, insert on public.ticket_replies to authenticated;
alter table public.ticket_replies enable row level security;
create policy "Members read replies on their tickets; staff read all" on public.ticket_replies
  for select to authenticated using (
    exists (select 1 from public.tickets t where t.id = ticket_id and t.user_id = (select auth.uid()))
    or exists (select 1 from public.staff s where s.user_id = (select auth.uid()))
  );
create policy "Members reply on their tickets; staff reply on any" on public.ticket_replies
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and (exists (select 1 from public.tickets t where t.id = ticket_id and t.user_id = (select auth.uid()))
      or exists (select 1 from public.staff s where s.user_id = (select auth.uid())))
  );

create function private.stamp_ticket_reply()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.from_staff := exists (select 1 from public.staff where user_id = new.user_id);
  new.author_name := case when new.from_staff then 'Support team'
    else coalesce(nullif((select name from public.netflix_tables where id = new.user_id), ''), 'Member') end;
  new.created_at := now();
  return new;
end;
$$;
revoke execute on function private.stamp_ticket_reply() from public, anon, authenticated;
create trigger stamp_ticket_reply
  before insert on public.ticket_replies
  for each row execute function private.stamp_ticket_reply();

-- 4. The staff queue: every ticket (optionally one status), newest first, with the member's name and email. Anyone
--    else gets an error. security definer because tickets and accounts are owner-only.
create function public.staff_tickets(p_status varchar default null)
returns table (id uuid, ticket_number varchar, issue_type varchar, title_id varchar, summary text, steps text,
  device varchar, status varchar, created_at timestamptz, member_name varchar, member_email varchar, replies bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.staff s where s.user_id = (select auth.uid())) then
    raise exception 'Only support staff can see the ticket queue.' using errcode = '42501';
  end if;
  return query
    select t.id, t.ticket_number, t.issue_type, t.title_id, t.summary, t.steps, t.device, t.status, t.created_at,
      n.name, n.email, (select count(*) from public.ticket_replies r where r.ticket_id = t.id)
    from public.tickets t
    join public.netflix_tables n on n.id = t.user_id
    where p_status is null or t.status = p_status
    order by t.created_at desc
    limit 200;
end;
$$;
revoke execute on function public.staff_tickets(varchar) from public, anon;
grant execute on function public.staff_tickets(varchar) to authenticated;

create function public.staff_set_ticket_status(p_ticket uuid, p_status varchar)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.staff s where s.user_id = (select auth.uid())) then
    raise exception 'Only support staff can change a ticket''s status.' using errcode = '42501';
  end if;
  update public.tickets set status = p_status where id = p_ticket;
  if not found then
    raise exception 'No such ticket.' using errcode = 'P0002';
  end if;
end;
$$;
revoke execute on function public.staff_set_ticket_status(uuid, varchar) from public, anon;
grant execute on function public.staff_set_ticket_status(uuid, varchar) to authenticated;
