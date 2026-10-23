-- Monthly donations: a Stripe subscription for the same amount every month, started on /donate and cancelled there or
-- in Account. The monthly-donation Edge Function creates it (and cancels it); the stripe-webhook function keeps its
-- status and records each month's payment in public.donations, linked by monthly_donation_id. Members read only
-- their own rows; nothing in the browser writes them.

create table public.monthly_donations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.netflix_tables (id) on delete cascade,
  amount integer not null check (amount between 100 and 1000000),
  stripe_customer_id text not null,
  stripe_subscription_id text not null unique,
  -- incomplete: the first payment hasn't gone through yet; past_due: a later payment failed and Stripe is retrying
  status text not null default 'incomplete' check (status in ('incomplete', 'active', 'past_due', 'canceled')),
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  canceled_at timestamptz
);

grant select on public.monthly_donations to authenticated;
revoke all on public.monthly_donations from service_role;
grant select, insert, update on public.monthly_donations to service_role;
alter table public.monthly_donations enable row level security;
create policy "Users read their own rows" on public.monthly_donations
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Two-step sign-in finished" on public.monthly_donations as restrictive for all to authenticated
  using ((select public.second_step_done())) with check ((select public.second_step_done()));

-- Each month's payment of a monthly donation (null for one-time donations)
alter table public.donations add column monthly_donation_id uuid references public.monthly_donations (id) on delete set null;

-- The staff list shows which donations are monthly: the return type changes, so the function is replaced
drop function public.staff_recent_donations(text);
create function public.staff_recent_donations(p_status text default null)
returns table (id uuid, amount integer, status text, created_at timestamptz, member_name varchar, stripe_payment_intent_id text,
  monthly boolean)
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
    select d.id, d.amount, d.status, d.created_at, coalesce(nullif(n.name, ''), 'Member')::varchar, d.stripe_payment_intent_id,
      d.monthly_donation_id is not null
    from public.donations d
    join public.netflix_tables n on n.id = d.user_id
    where p_status is null or d.status = p_status
    order by d.created_at desc
    limit 100;
end;
$$;
revoke execute on function public.staff_recent_donations(text) from public, anon;
grant execute on function public.staff_recent_donations(text) to authenticated;
