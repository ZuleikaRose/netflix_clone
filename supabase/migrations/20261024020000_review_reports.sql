-- Reporting a review: a member flags another member's review (spoilers, offensive, spam or something else) and support
-- staff see it on the support dashboard, where they keep the review or remove it. Each report keeps a copy of the
-- review as it was reported (title, author, text, stamped by a trigger), so the dashboard still shows what was
-- removed. Members read only their own reports; only the staff functions below change a report or remove a review.

create table public.review_reports (
  id uuid primary key default gen_random_uuid(),
  review_id uuid references public.review (id) on delete set null,
  user_id uuid not null default auth.uid() references public.netflix_tables (id) on delete cascade,
  reason varchar not null check (reason in ('spoilers', 'offensive', 'spam', 'other')),
  details text check (details is null or char_length(details) <= 500),
  title_id varchar,
  review_author varchar not null default '',
  review_body text not null default '',
  status varchar not null default 'Open' check (status in ('Open', 'Kept', 'Removed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  -- One report per member per review
  unique (review_id, user_id)
);

grant select on public.review_reports to authenticated;
grant insert (review_id, reason, details) on public.review_reports to authenticated;
alter table public.review_reports enable row level security;
create policy "Users read their own rows" on public.review_reports
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users add their own rows" on public.review_reports
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Two-step sign-in finished" on public.review_reports as restrictive for all to authenticated
  using ((select public.second_step_done())) with check ((select public.second_step_done()));

-- Fills in the reporter and the copy of the review; refuses a review that doesn't exist or is the member's own
create function private.stamp_review_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  reported public.review;
begin
  select * into reported from public.review where id = new.review_id;
  if not found or reported.body is null then
    raise exception 'That review no longer exists.' using errcode = 'P0001';
  end if;
  if reported.user_id = auth.uid() then
    raise exception 'You can''t report your own review.' using errcode = 'P0001';
  end if;
  new.user_id := auth.uid();
  new.title_id := reported.title_id;
  new.review_author := reported.author_name;
  new.review_body := reported.body;
  new.details := nullif(btrim(new.details), '');
  new.status := 'Open';
  new.created_at := now();
  new.resolved_at := null;
  return new;
end;
$$;
revoke execute on function private.stamp_review_report() from public, anon, authenticated;
create trigger stamp_review_report
  before insert on public.review_reports
  for each row execute function private.stamp_review_report();

-- The staff queue of reported reviews (optionally one status), newest first, with each reporter's name. Anyone else
-- gets an error.
create function public.staff_review_reports(p_status varchar default 'Open')
returns table (id uuid, review_id uuid, title_id varchar, review_author varchar, review_body text, reason varchar,
  details text, status varchar, created_at timestamptz, reporter_name varchar)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.second_step_done() or not exists (select 1 from public.staff s where s.user_id = (select auth.uid())) then
    raise exception 'Only support staff can see reported reviews.' using errcode = '42501';
  end if;
  return query
    select r.id, r.review_id, r.title_id, r.review_author, r.review_body, r.reason, r.details, r.status, r.created_at,
      coalesce(nullif(n.name, ''), 'Member')::varchar
    from public.review_reports r
    join public.netflix_tables n on n.id = r.user_id
    where p_status is null or r.status = p_status
    order by r.created_at desc
    limit 200;
end;
$$;
revoke execute on function public.staff_review_reports(varchar) from public, anon;
grant execute on function public.staff_review_reports(varchar) to authenticated;

-- Settles every open report on a review: keeps it, or deletes the review (its reports stay, marked Removed)
create function public.staff_resolve_review(p_review uuid, p_remove boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.second_step_done() or not exists (select 1 from public.staff s where s.user_id = (select auth.uid())) then
    raise exception 'Only support staff can settle reported reviews.' using errcode = '42501';
  end if;
  update public.review_reports set status = case when p_remove then 'Removed' else 'Kept' end, resolved_at = now()
    where review_id = p_review and status = 'Open';
  if not found then
    raise exception 'No open reports on that review.' using errcode = 'P0002';
  end if;
  if p_remove then
    delete from public.review where id = p_review;
  end if;
end;
$$;
revoke execute on function public.staff_resolve_review(uuid, boolean) from public, anon;
grant execute on function public.staff_resolve_review(uuid, boolean) to authenticated;
