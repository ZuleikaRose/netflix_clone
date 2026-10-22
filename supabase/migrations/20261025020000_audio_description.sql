-- Audio description: an accessibility menu switch (and a player button) that has the browser read out what happens
-- on screen, from each clip's descriptions track, in the caption language. Saved with the member's other settings.
alter table public.accessibility_settings add column audio_description boolean not null default false;
