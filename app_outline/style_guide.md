# Style Guide — Netflix Clone

**Vibe:** a dark, cinematic streaming app. The artwork leads: big posters, bold condensed titles, one red accent.
Calm, fast and readable. It should feel like a real streaming service, not a generic dashboard.

The source of truth for every value below is `netflix_clone/src/index.css` (plus `index.html` for fonts). Change both
together.

## Layout

* **Mobile-first:** designed for a 390px phone. The app column is at most 430px wide (`.phone`).
* **Desktop:** from 600px wide the app sits in a centered phone frame (up to 900px tall, rounded, 1px `#333` border)
  that scrolls inside itself, so the header and tab bar stay pinned.
* **Page header** (every page): sticky, translucent black (`#090909f2`) with a blur. Back button or brand on the left,
  the page title centered, and the accessibility menu button on the right.
* **Bottom tab bar** (signed in): Home · Games · New & Hot · My App, fixed at the bottom, highlighting the current
  page (My App also covers Watch list and Favorites).
* **Footer:** links to every info page, including the Accessibility Policy and the legal pages.
* **Side gutter:** 17px for rows and grids; no horizontal page scroll at any width.

## Color

| Role | Value | Use |
| --- | --- | --- |
| Background | `#090909` (page), `#101010`–`#303030` radial gradient (behind the desktop frame) | Everything sits on near-black |
| Surfaces | `#161616`, `#1a1a1a`, `#222`, `#262626` | Cards, inputs, chips, code |
| Borders | `#262626`, `#333`, `#3a3a3a`, `#555` | Dividers, inputs, secondary buttons |
| Text | `#fff` / `#f5f5f5` (primary), `#d4d4d4`, `#bcbcbc` (labels), `#a3a3a3` (muted) | Muted text never goes darker than `#a3a3a3` |
| **Accent** `--accent` | `#e50914` | The ONE brand red: primary buttons, active icons, Top 10 badges, the 404 code. Never for errors |
| **Error** `--error` | `#e87c03` (orange) | Form errors and warnings, always distinct from the accent |
| **Delete** `.delete-fill` | `#c40812` | Destructive actions only (Delete account), darker than the accent |
| Success | `#46d369` | Saved, matched, correct answer, "service is up" dot, check marks |
| Ratings | `#f5c518` | Stars |
| Maintenance banner | `#5c4a10` border, `#fbe7a1` text | Service notices on Home |
| Sign-in screens | radial `#3a0a0d` → `#090909` | Login, Sign up, Forgot/Reset password, Sign out |
| Coffee (donate) | `#8b5a2b`, `#a06a35` hover, `#5e3c1c` on /donate, `#f5f5f5` 2px ring | The round donate button only; not the accent, so it never competes with primary actions |

## Type

* **Body:** Inter (400/600/700), falling back to the system UI font.
* **Display:** Anton for page titles (22px), detail titles (34px), section heads (24px), prices and stats; Impact/Anton
  for poster titles, the hero title (47px) and the giant Top 10 numbers.
* **Code and keys:** `ui-monospace` for promo codes, the demo password and keyboard shortcuts (`<kbd>`).
* **Accessible fonts** (from the accessibility menu): Atkinson Hyperlegible ("Readable") and Lexend ("Dyslexia
  friendly"). All four fonts load from Google Fonts in `index.html`.

## Components

* **Primary button** (`.cta`): full width, at least 48px tall, 6px radius, bold 16px, accent red. Secondary
  (`.ghost-cta`): transparent with a `#555` border. Danger outline uses the error orange; Delete account uses
  `.delete-fill`.
* **Fields** (`components/Field.jsx`): a label on every input (13px, `#bcbcbc`), inputs at least 44px tall on `#1a1a1a`
  with a `#3a3a3a` border. Validate on submit, focus the first error, show errors in orange under the field.
* **Posters:** 124×178px, 4px radius, artwork dimmed (`brightness(.72)`) under a centered condensed title. Posters
  reuse four photos with a per-title CSS tint. TMDB posters are real poster art, so they show undimmed with no title
  on top (the link still carries the name) and load lazily.
* **Rows:** horizontal scrolling rows (Top 10 with giant outlined rank numbers 1–10 by place, TMDB's trending movies and shows (the catalog's ranked titles
  without TMDB), the 10th card wider so both digits show; Continue Watching with a red progress bar and an episode badge (E2…) on shows past episode 1; Because You Liked…, Because You Saved…, then New on TMDB
  and Trending and Popular Movies and TV Shows on TMDB), each with ‹ › buttons (44px, in the row heading) that page
  through it; a button at the row's end dims (`opacity: .35`) but keeps focus, and both hide when the row fits; grids of three posters on Watch list, Favorites and Search (TMDB
  results get their own grid under the catalog's).
* **TMDB credit:** wherever TMDB data appears, a muted 12px line (`#a3a3a3`) says "Movie and TV data from TMDB. This
  product uses the TMDB API but is not endorsed or certified by TMDB." TMDB title pages show the TMDB rating and a
  "View on TMDB" link instead of Play; My List and Favorite, ratings and reviews work as on catalog titles. "Play
  trailer" (accent button) swaps the artwork for a 16:9 YouTube (youtube-nocookie) player with a Close button; nothing
  loads from YouTube before that. "Where to watch in the U.S." lists services as chips (28px logo + name on `#1f1f1f`)
  under Stream, Rent and Buy, with a muted "Availability from JustWatch" credit; More Like This sits below.
* **Hero carousel:** a full-bleed 610px featured title with a dark gradient, centered title and actions, arrow
  buttons and dots. It never auto-advances. It features TMDB's five most popular movies and shows (sharp w780
  posters, "FILM · TMDB" eyebrow, genres, a white **More Info** button instead of Play, then My List), or the catalog's
  most popular titles without TMDB.
* **Chips and tabs:** pill chips for filters (active = white border on `#343434`); underlined tabs for sections.
* **Banners:** a green status banner on Support (service is up) and a gold maintenance banner on Home, which the
  member can dismiss.
* **Player:** black stage, large controls (play/pause, seek, skip 10 seconds, mute with a 64px volume slider, speed,
  previous/next episode for shows in a row of their own above the controls,
  full screen, CC), captions drawn on a dark box in three sizes, credits under the video.
* **Leaderboards:** a settings card under each game: a numbered list (44px rows, place in muted grey, the member's own
  row in gold `#f5c518` with "(you)"), then the "Show me on leaderboards" switch. First names only; off by default.
* **Profiles:** "Who's watching?" shows a 2-column grid of square avatars (blue, red, yellow, green, purple tiles with
  the initial in white) with names under them; Manage profiles puts a pencil on each. The current profile's avatar
  sits in Home's header.
* **Notifications bell:** in every page header after Search; a red count badge (accent, 18px pill, "9+" past nine)
  sits on the bell's corner inside its 44px target. Notifications list new items in bold with a red icon.
* **Episodes:** under a show's details: "Episodes" with a season select (44px), then one row per episode: code and
  name ("S1:E3 Undertow"), muted length, a 44px round Play button, and a 3px red progress bar on the episode in
  progress. TMDB episodes add a 16:9 still, air date and overview, and have no Play button.
* **Credits and people:** cast and crew names on title pages are underlined links (`#e5e5e5`, `#666` underline).
  Person pages show a 104px portrait beside a facts list, a biography folded with Read more, and a three-column
  poster grid with each role under its poster.
* **Search box:** a combobox; suggestions and recent searches drop down in a `#181818` panel with 44px options (icon,
  name, muted kind), the active one on `#2a2a2a`, and "Clear recent searches" at the bottom.
* **Add to a list:** a bordered disclosure under the actions, with a 44px checkbox row per list and a New list field.
* **Watch party:** the shared player on top, then cards: the title with a live activity line ("Sam paused at 1:05"),
  Watching now with names, the invite link with Copy, and the chat.
* **App notices:** offline and "new version ready" notices sit above the page on `#262626` with white text and a
  white Reload button; they're informational, so they don't use the accent or the error orange.
* **Coffee button:** a 52px circle with a white coffee cup, floating 12px above the tab bar's right end on every
  signed-in page (inside the phone frame on desktop), with a soft shadow. It links to /donate ("Donate: buy us a
  coffee") and turns darker there. Keyboard focus scrolls clear of it.
* **Donate page:** a settings card with the amount as pill radio choices ($5, $10, $25, $50, Other amount), the Stripe
  card field styled like our inputs (`#1a1a1a`, white text, orange when invalid), and a full-width accent "Donate
  $10.00" button. The result replaces the form: a focused "Thank you for your $10.00 donation" heading, or an alert
  box ("Your donation didn't go through" / "We couldn't reach the payment service" with Try again). Stripe's error
  codes are never shown.
* **Icon buttons:** at least 44×44px; pressed toggles invert to white.

## Touch targets and focus

* Every tap target is at least 44px tall; if the visual is smaller, a `::before` hit area makes up the size.
* Keyboard focus is always visible: a 2px white outline offset by 2px. Focus never hides behind the sticky header or
  tab bar (WCAG 2.4.11).

## Motion

* Subtle and quick: pages fade in over 0.22s; toggles "pop" once (0.25s); buttons press to 98%.
* Everything is turned off under `prefers-reduced-motion` and the menu's "Stop animations".
* No auto-advancing carousels (WCAG 2.2.2).
* Video never plays by itself unless the member turns on Autoplay previews or Autoplay next episode, and never under
  reduced motion or "Stop animations". Every preview has a pause/play button.

## Accessibility

* Target WCAG 2.2 AA, checked on every page by axe-core in the e2e tests. Text contrast is AA or better.
* **Accessibility menu** (icon in every page header, also signed out) with one-tap profiles (Seizure safe, Low vision,
  ADHD friendly, Dyslexia friendly, Keyboard navigation, Deaf & hard of hearing) and settings for text size
  (100–150%), font, line height, letter spacing, left-aligned text, contrast, saturation, link and heading
  highlights, strong focus outline, big cursor, reading guide (gold `#ffd84d` bar), hiding images, stopping
  animations, captions and caption size, and autoplay. Settings apply as `data-a11y-*` attributes on `<html>`; for
  members they are saved to their account.
* The video player works fully from the keyboard and has real closed captions.
* Labels on every input, headings on every page, and an Accessibility Policy page linked from the footer.

## Signed-in experience

* Members stay signed in after a refresh until they choose Sign out; while the session is restored, pages show a
  quiet "Signing you in…" status instead of flashing the sign-in screen.
* Saving shows at once (optimistic) and quietly rolls back if the save fails; save confirmations use the success
  green.
