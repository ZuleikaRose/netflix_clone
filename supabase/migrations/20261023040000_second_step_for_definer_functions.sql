-- Two-step sign-in, continued: the security-definer functions that read or change other members' rows skip row-level
-- security, so the restrictive "Two-step sign-in finished" policies don't cover them. These versions refuse a session
-- that hasn't entered its code yet (public.second_step_done()), like every table does. Otherwise unchanged from
-- migrations ..._support_dashboard and ..._watch_parties.

create or replace function public.staff_tickets(p_status character varying default null)
returns table (id uuid, ticket_number character varying, issue_type character varying, title_id character varying,
  summary text, steps text, device character varying, status character varying, created_at timestamptz,
  member_name character varying, member_email character varying, replies bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.second_step_done() or not exists (select 1 from public.staff s where s.user_id = (select auth.uid())) then
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

create or replace function public.staff_set_ticket_status(p_ticket uuid, p_status character varying)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.second_step_done() or not exists (select 1 from public.staff s where s.user_id = (select auth.uid())) then
    raise exception 'Only support staff can change a ticket''s status.' using errcode = '42501';
  end if;
  update public.tickets set status = p_status where id = p_ticket;
  if not found then
    raise exception 'No such ticket.' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.join_watch_party(p_code character varying)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  party public.watch_parties;
begin
  if not public.second_step_done() then
    raise exception 'Please finish signing in first.' using errcode = '42501';
  end if;
  select * into party from public.watch_parties where code = p_code and expires_at > now();
  if party.id is null then
    raise exception 'This watch party has ended or doesn''t exist.' using errcode = 'P0002';
  end if;
  insert into public.watch_party_members (party_id, user_id) values (party.id, (select auth.uid()))
    on conflict do nothing;
  return jsonb_build_object(
    'id', party.id,
    'code', party.code,
    'titleId', party.title_id,
    'host', (select name from public.netflix_tables where id = party.host_id),
    'expiresAt', party.expires_at
  );
end;
$$;
