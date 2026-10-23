-- The interface language (English or Spanish), chosen in the accessibility menu and saved with the member's other
-- settings, so the app comes back in their language on any device.
alter table public.accessibility_settings add column language varchar not null default 'en' check (language in ('en', 'es'));
