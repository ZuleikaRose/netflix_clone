# Netflix Clone

[![CI](https://github.com/ZuleikaRose/netflix_clone/actions/workflows/ci.yml/badge.svg)](https://github.com/ZuleikaRose/netflix_clone/actions/workflows/ci.yml)

A mobile-first video streaming app inspired by Netflix, built with **React 19**, **Vite 8** and **React Router 7** on
**Supabase**. The catalog comes from the Supabase REST API, with real trending, popular and searchable movies and TV
shows from [TMDB](https://www.themoviedb.org) through a Supabase Edge Function; members sign in with Supabase Auth, and their lists,
ratings, reviews, settings, tickets and affiliate data are saved in Postgres. Every page and feature traces back to the
planning documents in [`app_outline/`](app_outline/), and every user journey is covered by Playwright end-to-end and
WCAG 2.2 AA accessibility tests.

> You stay signed in after a refresh until you choose **Sign out**: the browser keeps your Supabase session, and your
> account, lists and settings load back from the database. Without Supabase configured (as in CI) the app runs on a
> built-in catalog and in-memory accounts that reset on refresh.

## Quick start

```bash
cd netflix_clone
npm install
cp .env.example .env.development.local   # optional: add the dev project's URL and publishable key
npm run dev          # http://localhost:5173 → choose "Use demo account"
npm run test:e2e     # full Playwright suite (first time: npx playwright install chromium)
```

With Supabase configured, **Use demo account** creates a private demo account just for you (random email and
password, shown on screen, deleted after 24 hours), and Home and Search add real movies and TV shows from TMDB.
Without it, the demo account lives in memory and the TMDB sections don't appear.

## What you can do

- **Browse and watch:** featured carousel with previews, Top 10, new releases, "Because You Liked…" recommendations, and title pages with synopsis, cast, crew, ratings and members' reviews. Every title plays a real sample clip from a Blender open movie, with real English captions, in a player with play/pause, seek, skip 10 seconds, mute, speed, full screen, closed captions, keyboard shortcuts and autoplay of the next episode.
- **Discover real titles:** new, trending and popular movies and TV shows from TMDB on Home (New on TMDB alternates new movies in theaters with TV shows airing this week), TMDB titles in Search (all of them to browse with no query, or matches for a query) with the same Type, Released, genre and Sort filters, and a TMDB page for each with its poster, overview, rating, maturity rating, length, cast and crew. TMDB titles are for discovery: they can't be played, saved or reviewed.
- **Scroll rows with a mouse:** every row on Home and More Like This has ‹ › buttons that page through it, besides swiping.
- **Find titles:** search by title, cast or genre; filter by genre, type and release year; sort by popularity, date or A–Z.
- **Save:** Watch list and Favorites pages, plus sharing links to titles.
- **Sign in safely:** Supabase Auth sign-up and sign-in, strong password rules (13+ characters with lowercase, uppercase, a digit and a symbol; leaked passwords are rejected), and a **Forgot password** page that emails a reset link.
- **Manage your account:** profile, password, plan, billing (payment method, billing date, pause, cancel), autoplay previews and next episode, maturity rating, privacy permissions, and a danger zone to delete your account.
- **Make it work for you:** an accessibility menu on every page with one-tap profiles and settings for text size, readable and dyslexia-friendly fonts, spacing, contrast, color, link and heading highlights, focus outline, big cursor, reading guide, hiding images, stopping animations and captions. Members' settings are saved and come back at sign-in.
- **Get help:** support hub with live chat, FAQs, feedback, issue reporting with ticket numbers from the database, technical requirements and a maintenance banner.
- **Save money and earn:** promo codes that discount your plan (checked on the server), and an **Affiliate Program** with a referral dashboard, tiered commissions and marketing materials; clicks and sign-ups on your link are counted.
- **Read the legal pages:** Legal & Privacy hub, Terms of Service, Privacy Policy, Accessibility Policy and a Do Not Sell opt-out.
- **Play:** two small games built from the catalog, with your best scores saved.

See [`netflix_clone/README.md`](netflix_clone/README.md) for the full route list, demo data and test details.

## Backend (Supabase) and the REST API

The backend is [Supabase](https://supabase.com): a hosted Postgres database with Supabase Auth, Edge Functions and
cron jobs. The React app has no server of its own; it talks to Supabase over HTTPS through
[`@supabase/supabase-js`](https://supabase.com/docs/reference/javascript), which calls these REST APIs:

| API | Used for | Code |
| --- | --- | --- |
| **Data REST API** (PostgREST) `/rest/v1/<table>` | Reading the catalog (`GET /rest/v1/titles`), reviews; reading and saving each member's account, preferences, watch list, favorites, reminders, ratings, feedback, tickets, game scores, affiliate data and accessibility settings (`GET`, `POST`, `PATCH`, `DELETE`, upserts) | `src/data/catalogApi.js`, `accountApi.js`, `libraryApi.js`, `accessibilityApi.js` |
| **Auth API** `/auth/v1` | Sign-up, sign-in, sign-out, token refresh, password change, password reset emails | `src/state/SupabaseAuthProvider.jsx` |
| **Edge Functions** `/functions/v1/<name>` | Things the browser must not do itself: create demo accounts, delete account access, apply promo codes, count referral clicks, call TMDB with the server-side API key | `callFunction()` in `src/data/accountApi.js`; `src/data/tmdbApi.js` |

Every request carries the project's **publishable key**, plus the member's access token once they're signed in.
Postgres row-level security decides what each request may read or change, so the browser never needs the secret key.
The session (access and refresh tokens) is kept in `localStorage`, which is what keeps members signed in after a
refresh; signing out removes it.

| Piece | What it does |
| --- | --- |
| Postgres tables | 16 tables in `public` ([`schema.sql`](schema.sql), diagram [`drawsql.png`](drawsql.png)) with row-level security: catalog titles and reviews (including ratings) are readable by anyone; private account data and lists are owner-only; promotions and rate-limit hits are server-only |
| Supabase Auth | Sign-up, sign-in, password reset emails and password rules; the sign-up trigger creates the member's account, preferences and referral sign-up |
| Edge Functions | `demo-account` (private demo accounts), `delete-account` (removes access), `apply-promo` (checks codes against `promotions`), `record-referral` (counts link clicks), `tmdb` (new, trending, popular, search and title details from TMDB, with the key in the project's `TMDB_API_FREE` setting); the public ones are rate limited per IP (for `tmdb`, only requests its cache can't answer count). `hello` and `multiply` are small public test endpoints. Production and dev run the same functions and migrations |
| Cron jobs | Delete demo accounts after 24 hours; delete old rate-limit hits |
| Projects | **eagle_platoon** (production) and **eagle_platoon_dev** (development, e2e tests and seed data) |

Migrations, index files, functions, seed data and pgTAP tests are in [`supabase/`](supabase/).

## Repository layout

| Path | What it is |
| --- | --- |
| [`netflix_clone/`](netflix_clone/) | The Vite app: source, Playwright tests, configs |
| [`supabase/`](supabase/) | Supabase CLI project: migrations, `non_transactional/` index files, Edge Functions, seeds, pgTAP tests |
| [`app_outline/`](app_outline/) | Requirements: [`user_journey.md`](app_outline/user_journey.md), per-page folders, [`style_guide.md`](app_outline/style_guide.md), Figma wireframe export |
| [`user_stories.md`](user_stories.md) | What the database stores, one user story per thing the app remembers |
| [`schema.sql`](schema.sql), [`drawsql.png`](drawsql.png) | The table design and its diagram, kept in step with the migrations |
| [`.github/workflows/ci.yml`](.github/workflows/ci.yml) | CI: lint, build, end-to-end and accessibility tests, plus pgTAP database tests against a local Supabase |
| [`CLAUDE.md`](CLAUDE.md) | Project guide: outline-to-route map, conventions, and how to apply outline changes |
| `page_1_planning_pipeline.png`, `page_2_8_question_practical_template.png`, `prompt.md` | Original planning material and the build prompts |

## Quality checks

- **132 Playwright tests:** every journey runs at phone (390×844) and desktop (1280×800) sizes, against an in-memory build and a Supabase build (the Supabase tests run when `.env.development.local` is present).
- **Accessibility:** an axe-core WCAG 2.2 AA audit of every page and key interactive state (including the accessibility menu, the player with captions, the delete-account form and the password reset pages), plus checks for 44px touch targets, visible keyboard focus, and focus never hidden behind the sticky bars.
- **Database:** 38 pgTAP tests of the access rules, triggers, cleanup job, rate limiter and indexes. Every foreign key is indexed, and Supabase's Index Advisor is installed on both projects.
- **CI** runs lint, build, the Playwright suite and the pgTAP tests on GitHub Actions; `main` requires both to pass.

## Notes

- Billing and payouts are simulated: only a card's brand, last 4 digits and expiry are kept, never the full number or CVC.
- The browser uses only the publishable key; the secret key stays in the Edge Functions.
- The catalog's own titles, people and legal text are placeholder content; TMDB titles are real. This product uses the TMDB API but is not endorsed or certified by TMDB; the notice appears wherever TMDB data does and in Legal & Privacy.
- Sample video clips are short excerpts of *Sintel*, *Tears of Steel* and *Elephants Dream* by the Blender Foundation (CC BY 3.0 / 2.5), with English captions from Wikimedia Commons (CC BY-SA 4.0). Credits are shown in the player and in the app's Legal & Privacy page.
