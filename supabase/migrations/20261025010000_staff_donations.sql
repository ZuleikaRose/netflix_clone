-- Donations on the support dashboard: staff see totals by month and the latest donations (who gave, how much, whether
-- it went through, and Stripe's payment id, to find it in the Stripe Dashboard for a refund). Members still read only
-- their own rows (migration ..._donations); these functions refuse everyone but support staff.

-- Paid and failed donations per calendar month (UTC), newest month first, for the last p_months months (1-36)
create function public.staff_donation_months(p_months integer default 12)
returns table (month date, paid_count bigint, paid_cents bigint, failed_count bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.second_step_done() or not exists (select 1 from public.staff s where s.user_id = (select auth.uid())) then
    raise exception 'Only support staff can see donations.' using errcode = '42501';
  end if;
  return query
    select date_trunc('month', d.created_at at time zone 'UTC')::date,
      count(*) filter (where d.status = 'succeeded'),
      coalesce(sum(d.amount) filter (where d.status = 'succeeded'), 0)::bigint,
      count(*) filter (where d.status = 'failed')
    from public.donations d
    where d.created_at >= date_trunc('month', now() at time zone 'UTC') at time zone 'UTC'
      - make_interval(months => greatest(least(p_months, 36), 1) - 1)
    group by 1
    order by 1 desc;
end;
$$;
revoke execute on function public.staff_donation_months(integer) from public, anon;
grant execute on function public.staff_donation_months(integer) to authenticated;

-- The latest 100 donations (optionally only 'succeeded' or 'failed'), newest first, with each member's name
create function public.staff_recent_donations(p_status text default null)
returns table (id uuid, amount integer, status text, created_at timestamptz, member_name varchar, stripe_payment_intent_id text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.second_step_done() or not exists (select 1 from public.staff s where s.user_id = (select auth.uid())) then
    raise exception 'Only support staff can see donations.' using errcode = '42501';
  end if;
  return query
    select d.id, d.amount, d.status, d.created_at, coalesce(nullif(n.name, ''), 'Member')::varchar, d.stripe_payment_intent_id
    from public.donations d
    join public.netflix_tables n on n.id = d.user_id
    where p_status is null or d.status = p_status
    order by d.created_at desc
    limit 100;
end;
$$;
revoke execute on function public.staff_recent_donations(text) from public, anon;
grant execute on function public.staff_recent_donations(text) to authenticated;
