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

- **Browse and watch:** featured carousel with previews, Continue Watching (where you stopped, saved to your account so it follows you to any device; finishing an episode moves you to the next), a Top 10 (the catalog's ranked titles, filled up to ten with TMDB's trending movies and shows), "Because You Liked…" recommendations, and title pages with synopsis, cast, crew, ratings and members' reviews. Every title plays a real sample clip from a Blender open movie, with real English captions, in a player with play/pause, seek, skip 10 seconds, mute and a volume slider (↑/↓ keys; a member's level follows them to any device), speed, previous and next episode for TV shows (Shift+P / Shift+N), full screen, picture-in-picture, closed captions, keyboard shortcuts and autoplay of the next episode. Shows offer Skip Recap and Skip Intro, every title offers Skip Outro (straight to the end, or the next-episode countdown), full screen on a phone or tablet turns the video sideways, the progress bar marks chapters, and pointing at it previews the frame there.
- **Discover real titles:** new, trending and popular movies and TV shows from TMDB on Home (New on TMDB alternates new movies in theaters with TV shows airing this week), TMDB titles in Search (all of them to browse with no query, or matches for a query) with the same Type, Released, genre and Sort filters, and a TMDB page for each with its poster, overview, rating, maturity rating, length, cast and crew, its trailer (from YouTube, loaded only when you press Play trailer), where to stream, rent or buy it in the U.S. (from JustWatch) and More Like This. Members can add TMDB titles to My List and Favorites and rate and review them; saving one adds a "Because You Saved…" row on Home. TMDB titles carry their real U.S. ratings, so restricted profiles see the ones that fit. They can't be played.
- **Rate in one tap:** Not for me, I like this or Love this! on any title, per profile. Loved and liked titles shape Because You Liked; Not for me keeps a title out of recommendations.
- **Ask what to watch:** describe what you're in the mood for ("something tense under two hours") and get up to five titles with a reason each, picked by Claude (Anthropic's AI) from the titles your profile can watch, or by matching your words when the AI service isn't available.
- **Look back:** Year in Review sums up a profile's year (titles, episodes, hours, streak, busiest month, top genres, the actor seen most) with a summary to share.
- **Scroll rows with a mouse:** every row on Home and More Like This has ‹ › buttons that page through it, besides swiping.
- **Find titles:** search by title, cast or genre (misspellings still find the title: "nite shift" → Night Shift), with suggestions for titles, people and genres while you type and your recent searches when the box is empty; filter by genre, type and release year; sort by popularity, date or A–Z.
- **Profiles:** up to five per account, including Kids profiles; each has its own lists, Continue Watching, history, game scores, thumbs ratings and maturity rating. Any profile can be locked with a four-digit PIN, and Kids profiles ask a grown-up for the account password before account or profile settings open.
- **People and episodes:** actor and director pages (from TMDB, or everything a catalog actor is in); every show lists its seasons and episodes, and any episode can be played.
- **Watch together:** start a watch party and share the invite link: play, pause and skipping happen for everyone, with who's watching and a chat (Supabase Realtime, members only).
- **Lists and reminders:** your own named lists, shareable by link with anyone; reminders for films not out yet and a notifications bell for releases and support replies.
- **Your history, your call:** viewing activity by day that you can hide, download, pause or have deleted after 90 days or a year.
- **Install it:** add the app to your home screen or desktop; pages you've opened work offline.
- **Save:** Watch list and Favorites pages (catalog and TMDB titles), custom lists, plus sharing links to titles.
- **Sign in safely:** Supabase Auth sign-up and sign-in, strong password rules (13+ characters with lowercase, uppercase, a digit and a symbol; leaked passwords are rejected), a **Forgot password** page that emails a reset link, optional **two-step sign-in** with an authenticator app (until the code is entered, the database shows none of your data), and a list of signed-in devices you can sign out.
- **Manage your account:** profile, password, plan, billing (payment method, billing date, pause, cancel), autoplay previews and next episode, maturity rating, privacy permissions, and a danger zone to delete your account.
- **Make it work for you:** an accessibility menu on every page with one-tap profiles and settings for text size, readable and dyslexia-friendly fonts, spacing, contrast, color, link and heading highlights, focus outline, big cursor, reading guide, hiding images, stopping animations and captions. Members' settings are saved and come back at sign-in.
- **Get help:** support hub with live chat, FAQs, feedback, issue reporting with ticket numbers from the database (and support's replies, which you can answer), technical requirements and a maintenance banner. Support staff work the tickets on a support dashboard.
- **Save money and earn:** promo codes that discount your plan (checked on the server), and an **Affiliate Program** with a referral dashboard, tiered commissions and marketing materials; clicks and sign-ups on your link are counted.
- **Buy us a coffee:** a round coffee button at the bottom right of every page opens a donation page: pick $5, $10, $25, $50 or any amount from $1 to $10,000 and pay once, or every month until you cancel, by card through Stripe. You get a thank-you with the amount, a plain explanation if the card is declined, or "being processed" while your bank confirms it, and no retry ever charges twice: not after a declined card, a dropped connection or a changed amount. Card numbers go straight to Stripe and never reach the app. The donation page lists your past donations, and Stripe emails a receipt. A monthly donation shows its amount and next payment on the donation page and in Account, where you can cancel it any time; closing your account stops it.
- **Surprise me:** a button on Home and Search opens a random title your profile can watch: one of the app's own, or a movie or TV show from TMDB.
- **Keyboard shortcuts:** press **?** on any page to see every shortcut.
- **Screen-time limits:** give a profile (say, a Kids profile) a daily limit with the account password; the player stops when it's used up, and only the account password allows more time.
- **Spanish captions:** choose Caption language → Español in the accessibility menu.
- **The whole app in Spanish:** choose Language & translation → Español at the top of the accessibility menu (or arrive in Spanish when your browser is); the choice follows you to every device. Synopses and episode names are translated, and TMDB's titles, overviews and genre names come in Spanish too; title names, cast and reviews stay as published.
- **Every screen size:** phones get the mobile design; tablets fill the width; notebooks, Chromebooks and desktops (Windows, Mac, Linux) get a top bar and a wide banner.
- **Audio description:** turn it on from the player's AD button, the D key or the accessibility menu, and the player reads out what happens on screen in your caption language, pausing the video while it speaks.
- **Weekly screen time:** for a profile with a daily limit, see how long it watched on each of the last 7 days, with the total and the daily average.
- **Offline downloads:** download a title from its page and watch it with no connection (My App → Downloads), with captions and audio description in English or Spanish.
- **Report a review:** flag another member's review; the support team keeps or removes it from the support dashboard.
- **Helpful reviews:** mark another member's review as helpful (and take it back), and sort reviews by most helpful or newest.
- **Donations for staff:** the support dashboard shows donations by month (amount paid, paid and failed counts) and the latest donations, each linked to its payment in Stripe.
- **Read the legal pages:** Legal & Privacy hub, Terms of Service, Privacy Policy, Accessibility Policy and a Do Not Sell opt-out.
- **Play:** six small games built from the catalog, with your best scores saved: Poster Match (memory), Plot Twist (guess the title from its synopsis), Timeline (put titles in release order), Cast Call (match an actor to their title), Higher or Lower (which title is more popular, as a streak) and Title Scramble (unscramble a title, with an optional hint). Each game has a top-ten leaderboard of members who chose to show their first name and best score (off by default).

See [`netflix_clone/README.md`](netflix_clone/README.md) for the full route list, demo data and test details.

## Backend (Supabase) and the REST API

The backend is [Supabase](https://supabase.com): a hosted Postgres database with Supabase Auth, Edge Functions and
cron jobs. The React app has no server of its own; it talks to Supabase over HTTPS through
[`@supabase/supabase-js`](https://supabase.com/docs/reference/javascript), which calls these REST APIs:

| API | Used for | Code |
| --- | --- | --- |
| **Data REST API** (PostgREST) `/rest/v1/<table>` | Reading the catalog (`GET /rest/v1/titles`), reviews; reading and saving each member's account, preferences, watch list, favorites, reminders, ratings, feedback, tickets, game scores, affiliate data and accessibility settings (`GET`, `POST`, `PATCH`, `DELETE`, upserts) | `src/data/catalogApi.js`, `accountApi.js`, `libraryApi.js`, `accessibilityApi.js` |
| **Auth API** `/auth/v1` | Sign-up, sign-in, sign-out, token refresh, password change, password reset emails | `src/state/SupabaseAuthProvider.jsx` |
| **Edge Functions** `/functions/v1/<name>` | Things the browser must not do itself: create demo accounts, delete account access, apply promo codes, count referral clicks, call TMDB with the server-side API key, start a Stripe payment for a donation, start or cancel a monthly donation (Stripe itself calls `stripe-webhook` with the result) | `callFunction()` in `src/data/accountApi.js`; `src/data/tmdbApi.js` |

Every request carries the project's **publishable key**, plus the member's access token once they're signed in.
Postgres row-level security decides what each request may read or change, so the browser never needs the secret key.
The session (access and refresh tokens) is kept in `localStorage`, which is what keeps members signed in after a
refresh; signing out removes it.

| Piece | What it does |
| --- | --- |
| Postgres tables | 34 tables in `public` ([`schema.sql`](schema.sql), diagram [`drawsql.png`](drawsql.png)) with row-level security: catalog titles and reviews (including ratings) are readable by anyone, as are the TMDB titles members save (`tmdb_titles`, written only by the `tmdb` function); private account data, lists, watch progress and preferences (including the player volume and the leaderboard opt-in) are owner-only; leaderboards are read through `game_leaderboard()`, which returns opted-in first names and scores only; promotions, rate-limit hits and TMDB certifications are server-only; `donations` (amount, status and Stripe's payment id, never card details) is readable by its owner only and written only by the `stripe-webhook` function, as is `monthly_donations` (a member's Stripe subscription; also written by `monthly-donation`); `review_helpful_votes` (a member's own helpful votes, never on their own review; the counts on `review` are kept by triggers); `screen_time` (time watched per limited profile and day) and `review_reports` (reported reviews) change only through database functions that check the account password or staff role |
| Supabase Auth | Sign-up, sign-in, password reset emails and password rules; the sign-up trigger creates the member's account, preferences and referral sign-up |
| Edge Functions | `demo-account` (private demo accounts), `delete-account` (removes access), `apply-promo` (checks codes against `promotions`), `record-referral` (counts link clicks), `tmdb` (new, trending, popular, search and title details from TMDB with trailers, U.S. watch providers and U.S. certifications, `recommendations`, and `save`, which stores a TMDB title a signed-in member adds to a list, with the key in the project's `TMDB_API_FREE` setting); the public ones are rate limited per IP (for `tmdb`, only requests its cache can't answer count). `assistant` (What should I watch?: Claude picks from the profile's allowed titles, with the key in the project's `ANTHROPIC_API_KEY` setting; signed in and rate limited). `hello` and `multiply` are small public test endpoints. `process-donation` (creates a Stripe PaymentIntent for the signed-in member, $1–$10,000, with Stripe's API key in the function settings) and `stripe-webhook` (checks Stripe's signature and records each payment once in `donations`, and each monthly payment and subscription change). On the dev project so far: `monthly-donation` (starts or cancels a member's Stripe subscription); production has the tables for it already |
| Database functions | `game_leaderboard()`, `staff_tickets()` / `staff_set_ticket_status()` (support staff only), `shared_list()` (public lists), `join_watch_party()`, `search_titles()` (typo-tolerant, pg_trgm), `year_in_review()`, `set_profile_pin()` / `unlock_profile()` / `verify_account_password()` (PINs are bcrypt hashes outside the API), `my_sessions()` / `end_session()` (signed-in devices), `staff_donation_months()` / `staff_recent_donations()` (support staff only), called as `/rest/v1/rpc/<name>`. With two-step sign-in on, a restrictive policy on every table (`second_step_done()`) blocks a session until its code is entered |
| Realtime | Watch parties: a private channel per party (`party:<code>`) for play/pause sync, presence and chat; RLS on `realtime.messages` admits only the party's members |
| Cron jobs | Delete demo accounts after 24 hours; delete old rate-limit hits; delete viewing history past each member's limit; delete ended watch parties |
| Projects | **eagle_platoon** (production) and **eagle_platoon_dev** (development, e2e tests and seed data) |

Migrations, index files, functions, seed data and pgTAP tests are in [`supabase/`](supabase/).

## Repository layout

| Path | What it is |
| --- | --- |
| [`netflix_clone/`](netflix_clone/) | The Vite app: source, Playwright tests, configs (also published on its own as [netflix_clone_front_end](https://github.com/ZuleikaRose/netflix_clone_front_end), live on Vercel at [front-end-sepia-rho.vercel.app](https://front-end-sepia-rho.vercel.app), and kept in step with this folder, six new features included) |
| [`supabase/`](supabase/) | Supabase CLI project: migrations, `non_transactional/` index files, Edge Functions, seeds, pgTAP tests |
| [`app_outline/`](app_outline/) | Requirements: [`user_journey.md`](app_outline/user_journey.md), per-page folders, [`style_guide.md`](app_outline/style_guide.md), Figma wireframe export |
| [`user_stories.md`](user_stories.md) | What the database stores, one user story per thing the app remembers |
| [`schema.sql`](schema.sql), [`drawsql.png`](drawsql.png) | The table design and its diagram, kept in step with the migrations |
| [`.github/workflows/ci.yml`](.github/workflows/ci.yml) | CI: lint, build, end-to-end and accessibility tests, plus pgTAP database tests against a local Supabase |
| [`CLAUDE.md`](CLAUDE.md) | Project guide: outline-to-route map, conventions, and how to apply outline changes |
| `page_1_planning_pipeline.png`, `page_2_8_question_practical_template.png`, `prompt.md` | Original planning material and the build prompts |

## Quality checks

- **318 Playwright tests:** every journey runs at phone (390×844) and desktop (1280×800) sizes, the page sweeps also at 320, 768, 1024, 1366 and 1920px and in a tablet window and Firefox (Safari isn't tested), against an in-memory build and a Supabase build (the Supabase tests run when `.env.development.local` is present). The donation tests pay with Stripe's test cards (4242… succeeds, 4000…0002 is declined) on the dev project, and start and cancel a test-mode monthly donation. The Spanish interface has its own tests, and `npm run lint` checks that every interface text has a Spanish translation.
- **Accessibility:** an axe-core WCAG 2.2 AA audit of every page and key interactive state (including the accessibility menu, the player with captions, the delete-account form and the password reset pages), plus checks for 44px touch targets, visible keyboard focus, and focus never hidden behind the sticky bars.
- **Database:** pgTAP tests of the access rules (including saved TMDB titles, the player volume, watch progress, opt-in leaderboards, donations, monthly donations and helpful votes), triggers, cleanup job, rate limiter and indexes. Every foreign key is indexed, and Supabase's Index Advisor is installed on both projects.
- **CI** runs lint, build, the Playwright suite and the pgTAP tests on GitHub Actions; `main` requires both to pass. The front-end repo runs the same lint, build and Playwright job on its own pull requests (there's no database there), and Vercel builds a preview of each one.

## Notes

- Billing and payouts are simulated: only a card's brand, last 4 digits and expiry are kept, never the full number or CVC.
- Donations are real Stripe payments: test mode on the dev project, live on production. The card field
  is Stripe's own, so card details go straight to Stripe; the app keeps only the amount, the result and Stripe's
  payment id.
- The browser uses only the publishable key; the secret key stays in the Edge Functions.
- The catalog's own titles, people and legal text are placeholder content; TMDB titles are real. This product uses the TMDB API but is not endorsed or certified by TMDB; the notice appears wherever TMDB data does and in Legal & Privacy.
- Sample video clips are short excerpts of *Sintel*, *Tears of Steel* and *Elephants Dream* by the Blender Foundation (CC BY 3.0 / 2.5), with English captions from Wikimedia Commons (CC BY-SA 4.0). Credits are shown in the player and in the app's Legal & Privacy page.
