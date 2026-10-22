-- Caption language: the accessibility menu's Caption language (English or Spanish captions in the player), saved per
-- member with the other accessibility settings
alter table public.accessibility_settings add column caption_language varchar not null default 'en'
  check (caption_language in ('en', 'es'));
