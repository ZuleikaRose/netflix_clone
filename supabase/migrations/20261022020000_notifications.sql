-- Notifications: the bell counts what a profile hasn't seen yet (released reminders, support replies). Each profile
-- remembers when it last opened its notifications, so the count follows it to other devices. Existing profiles start
-- from now, so nothing from before this migration shows as new.
alter table public.profiles
  add column notifications_seen_at timestamptz not null default now();

-- Reminders keep the release (or next episode) date they were set for; it was always nullable and stays so for the
-- catalog's titles, which are already out. A reminder is for one day, so it needs no time zone.
comment on column public.reminders.release_date is 'When the title (or a show''s next episode) comes out, from TMDB';
