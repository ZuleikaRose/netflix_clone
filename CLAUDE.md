# Netflix Clone — project guide

Mobile-first streaming app (React 19 + Vite 8 + React Router 7 `BrowserRouter`) on Supabase: the catalog comes from
the REST API, members sign in with Supabase Auth and their lists, reviews, settings and tickets are saved in Postgres.
Without Supabase configured (CI) it falls back to a built-in catalog and in-memory accounts.
Requirements live in `app_outline/`; the app lives in `netflix_clone/`; the database lives in `supabase/`.

## Layout

```
app_outline/          Requirements (source of truth for features)
  user_journey.md     Planning pipeline + 8-question template; §6 lists every required page
  pages/<Page>/       One folder per page; each holds a copy of user_journey.md
  style_guide.md      Visual rules (see "Design rules" below)
netflix_clone/        The Vite app — run all npm commands here
  src/data/           Catalog, plans, billing, promotions, affiliate program, FAQs, legal copy, service status
  src/data/catalogApi.js, accountApi.js, libraryApi.js   Supabase queries ↔ the shapes the pages use
  src/lib/            supabaseConfig.js (config, authBackend, lazy getSupabase()), supabase.js (the client)
  src/state/          CatalogProvider (titles), AuthProvider → SupabaseAuthProvider or MemoryAuthProvider (accounts,
                      billing, preferences), LibraryProvider (lists, ratings, scores, watch progress, tickets…), useReviews,
                      AccessibilityProvider (accessibility menu settings)
  src/pages/          One file per route; info/, games/ and account/ hold sub-pages
  src/components/     Layout (tab bar or wide-screen top bar, footer), PageHeader, Field, Player, Preview, AccessibilityPanel, hooks
  src/i18n/           Spanish interface: index.js (English text is the key; tr(), locale()), es/<area>.js dictionaries
                      (es/content.js: the built-in catalog's synopses and episode names)
  scripts/            i18n-check.mjs (run by npm run lint), pwa-icons.mjs, thumbnails.mjs
  e2e/                Playwright specs, serve.js (static server), ports.js (ports + dev project config)
  public/             manifest.webmanifest, sw.js (service worker), icons/ (drawn by scripts/pwa-icons.mjs), media/
  .env.example        Copy to .env.development.local (dev project) and .env.production.local (production); git-ignored
supabase/             Supabase CLI project (config.toml); MCP config in supabase/.mcp.json (not committed)
  migrations/         Schema + RLS, catalog titles, auth support (triggers, promotions, cleanup cron), rate limits,
                      saved TMDB titles, watch progress and leaderboards, profiles, support dashboard, notifications,
                      viewing history, custom lists, watch parties (Realtime RLS), better search (pg_trgm), thumbs
                      ratings, Year in Review, profile locks, two-step sign-in (restrictive policies, devices), donations,
                      screen-time limits, caption language, reported reviews, helpful votes, staff donations view,
                      audio description, monthly donations, interface language
  non_transactional/  CREATE INDEX CONCURRENTLY files: apply with psql after migrations (the CLI can't run them)
                      (Index Advisor is installed on both projects: dashboard → Query Performance suggests missing ones)
  functions/          Edge Functions: demo-account, delete-account, apply-promo, record-referral, tmdb, assistant,
                      process-donation, monthly-donation, stripe-webhook (+ _shared/:
                      clients, CORS, caller check, per-IP rate limits via public.hit_rate_limit); hello and multiply are
                      standalone public test endpoints
  seeds/              Development test data (6 example.com users, rows in every table); never run on production
  tests/database/     pgTAP tests (`supabase test db`): access rules, triggers, cleanup job, rate limiter, indexes
  diagram/            erd.html (source of drawsql.png) + render.mjs (`node supabase/diagram/render.mjs` redraws it)
schema.sql, drawsql.png  The table design and its diagram, kept in step with the migrations (all 34 public tables)
user_stories.md       What the database stores, one story per thing the app remembers
prompt.md             The original build prompt and the Supabase-phase prompts
.github/workflows/    CI: lint, build, Playwright; pgTAP against a local Supabase (Docker)
```

Supabase projects (org "Zuleika LLC", Pro plan): **eagle_platoon** `czgzptjegmkvrxnxduxs` = production,
**eagle_platoon_dev** `cfcbhwwpslgxjpijdnfy` = development and e2e tests (has the seed data). Apply every migration,
non_transactional file and function to dev first, then production, with the same migration version on both.
Both run all 29 migrations (through `20261025040000_interface_language`) and non_transactional 001–012 (production
caught up 2026-10-23). Both have the same 11 functions (with `monthly-donation`, and the monthly versions of
`stripe-webhook` and `delete-account`; the deployed bundles match). Production's live Stripe webhook has the four
monthly events too (`invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`,
`customer.subscription.deleted`), and monthly donations are live: a $1.00 live monthly donation was started, its
first payment recorded and linked, and cancelled on 2026-10-23. Change the live webhook in the Stripe dashboard (the
Stripe connector reaches this account in test mode only); a webhook event the function doesn't receive leaves a
monthly donation's row out of step with Stripe.
`assistant`
needs the `ANTHROPIC_API_KEY` function secret on each project (without it the app matches words).
The donation functions need two function variables per project:
`STRIPE_SECRET_KEY` (a test-mode key on dev, a live key on production; without it process-donation answers 503)
and `STRIPE_WEBHOOK_SECRET`, the signing value of the Stripe webhook endpoint that points at
`<project>.supabase.co/functions/v1/stripe-webhook`
(events `payment_intent.succeeded` and `payment_intent.payment_failed`, plus the four `invoice.*` /
`customer.subscription.*` events for monthly donations on dev). Never put either value in the repo.
Production takes live payments in the **Demo_Netflix_Clone** Stripe account (live webhook endpoint registered;
first live $1.00 donation recorded 2026-10-22); dev uses the same account in test mode. The live `pk_live_` key is
set only in the front-end repo's `.env.production.local` (and must be in the host's settings once it's hosted).
**Hosting**: Vercel (team `zuleika-llc`, Hobby plan, project `front-end`) builds the front-end repo on every pull
request (a preview) and every merge to `main` (production). The live site is **https://front-end-sepia-rho.vercel.app**
(public; no custom domain). Standard Deployment Protection keeps everything else behind a Vercel team sign-in: the
team address `front-end-zuleika-llc.vercel.app`, each deployment's own address and the previews. The project's
environment variables (Production and Preview) are `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
`VITE_AUTH_BACKEND` and `VITE_STRIPE_PUBLISHABLE_KEY`; production's build uses the production project, Supabase
Auth and the live Stripe key (checked 2026-10-23). `.env.production.local` isn't in git, so change them in Vercel
too (`vercel env ls --scope zuleika-llc --project front-end`).
`apply_migration` stamps the current time as the version: afterwards set it to the file's version in
`supabase_migrations.schema_migrations`, and apply one migration per second or less often, or two get the same stamp
and the second fails on the duplicate version.
Each project needs the `TMDB_API_FREE` Edge Function secret for `tmdb` (the dashboard can't show it back; the value
comes from themoviedb.org → Settings → API). The DROP INDEX steps at the end of `002_query_indexes.sql` haven't run on
either project yet (they only remove indexes the new composite ones make redundant).

The repo root also has a stray `package.json`/`package-lock.json`/`node_modules` from an early misplaced
install. They are intentionally **not committed**; don't add them.

## Commands (from `netflix_clone/`)

```bash
npm run dev            # http://localhost:5173
npm run lint
npm run build
npm run test:e2e       # two builds: :4173 in-memory accounts, :4174 Supabase Auth; all specs at 390px and 1280px
npm run test:e2e:report
```

Database (from the repo root, Supabase CLI v2.119.0 in `~/.local/bin`): `supabase db start`, `supabase db reset --local`,
then the `non_transactional/` files with psql, then `supabase test db` — the same steps CI runs. Docker is needed
locally (it isn't installed in this WSL distro, so CI is where these run today).

## Outline page → route map

| Outline page (§6) | Route | File |
| --- | --- | --- |
| Homepage | `/` | `pages/Home.jsx` (featured carousel, service banner, personalized row) |
| Movie / TV Show detail (incl. video player, captions) | `/title/:id` (`?play=1` opens the player) | `pages/TitleDetail.jsx`, `components/Player.jsx`, `data/clips.js`, `public/media/` |
| Search Results | `/search` | `pages/Search.jsx` (query, genre, type, release year, sort — all in the URL) |
| Watch list / Favorites | `/watchlist`, `/favorites` (`/my-netflix` = watch list) | `pages/MyNetflix.jsx` |
| Account Settings (incl. billing, autoplay, accessibility, delete account) | `/account` | `pages/Account.jsx`, `pages/account/Billing.jsx`, `pages/account/DeleteAccount.jsx` |
| Login / Signup / Logout | `/login`, `/signup`, `/logout` | `pages/Login.jsx`, `Signup.jsx`, `Logout.jsx` |
| Forgot / Reset Password | `/forgot-password`, `/reset-password` | `pages/ForgotPassword.jsx`, `ResetPassword.jsx` |
| Customer Support, FAQs, Feedback, Issue Reporting | `/info/support`, `/info/faqs`, `/info/feedback`, `/info/report-issue` | `pages/info/*` |
| Promotions/Discounts, Technical Requirements, AI Integration | `/info/promotions`, `/info/tech-requirements`, `/info/ai` | `pages/info/*` |
| Affiliate Program | `/info/affiliate` | `pages/info/Affiliate.jsx`, data in `data/affiliate.js` |
| Legal and Privacy, Terms, Privacy Policy, Do Not Sell | `/info/legal`, `/info/terms`, `/info/privacy`, `/info/do-not-sell` | `pages/info/LegalHub.jsx`, `Legal.jsx`, `DoNotSell.jsx` |
| Accessibility Policy | `/info/accessibility` | `pages/info/AccessibilityPolicy.jsx` |
| Accessibility menu (every page) | header icon, `<dialog>` | `components/AccessibilityPanel.jsx`, `state/AccessibilityProvider.jsx`, `state/accessibilityContext.js` |
| Error | any unknown route | `pages/NotFound.jsx` |
| (extra) Games, New & Hot | `/games`, `/games/:gameId` (`memory`, `trivia`, `timeline`, `cast`, `higher-lower`, `scramble`), `/new` | `pages/Games.jsx` (the list: name, art, blurb, `canPlay`, score label), `pages/games/*`, `pages/NewHot.jsx` |
| (extra) TMDB movie / TV show | `/tmdb/:type/:tmdbId` (`movie` or `show`) | `pages/TmdbTitle.jsx`, `data/tmdbApi.js`, `state/useTmdb.js` |
| (extra) Who's watching | `/profiles` | `pages/Profiles.jsx`, `state/ProfileProvider.jsx`, `components/RequireProfile.jsx`, `data/profiles*.js` |
| (extra) Actor / director | `/tmdb/person/:personId`, `/people/:name` (catalog) | `pages/TmdbPerson.jsx`, `pages/Person.jsx`, `data/people.js`, `components/CreditLinks.jsx` |
| (extra) Notifications | `/notifications` (bell in every header) | `pages/Notifications.jsx`, `components/NotificationBell.jsx`, `data/notifications.js` |
| (extra) Viewing activity | `/history` | `pages/ViewingActivity.jsx` |
| (extra) Custom lists | `/lists`, `/lists/:listId`, `/shared/:slug` (public) | `pages/MyLists.jsx`, `ListDetail.jsx`, `SharedList.jsx`, `components/AddToList.jsx` |
| (extra) Watch party | `/party/:code` | `pages/WatchParty.jsx`, `state/usePartyChannel.js`, `data/partyApi.js` |
| (extra) Support dashboard (staff) | `/support-dashboard` | `pages/SupportDashboard.jsx`, `state/useSupportQueue.js`, `data/supportApi.js` |
| (extra) Year in Review | `/year-in-review` | `pages/YearInReview.jsx`, `data/yearInReview.js` |
| (extra) What should I watch? (assistant) | `/what-to-watch` | `pages/Assistant.jsx`, `data/assistant.js`, `supabase/functions/assistant` |
| (extra) Security (two-step sign-in, devices) | in `/account` | `pages/account/Security.jsx`, `data/totp.js`, `data/devices.js` |
| (extra) Downloads (offline) | `/downloads` (linked from My App; "Download to watch offline" on catalog title pages) | `pages/Downloads.jsx`, `components/DownloadButton.jsx`, `data/downloads.js`, `state/useDownloads.js`, `public/sw.js` |
| (extra) Donate (one-time or monthly, Stripe) | `/donate` (linked from Account → Help and the round coffee button above the tab bar on every page); Your monthly donation also in `/account` | `pages/Donate.jsx`, `pages/donate/DonateForm.jsx` (lazy), `components/MonthlyDonation.jsx`, `state/useMonthlyDonation.js`, `data/donations.js`, `lib/stripe.js`, `supabase/functions/process-donation`, `monthly-donation` |

When the outline changes: diff `app_outline/user_journey.md` (`git diff --word-diff`), map each change to this
table, add or extend the page, add `/info/<slug>` pages to `data/infoPages.js` (that also adds the footer link)
and `pages/InfoPage.jsx`, then add the route to the sweeps in `e2e/layout.spec.js` and `e2e/a11y.spec.js`.
Every `app_outline/pages/<Page>/user_journey.md` is a copy of `app_outline/user_journey.md`; copy it to all of them
after editing.

## Conventions

- **Sessions survive a reload (Supabase)** — the client runs with `persistSession: true` under the localStorage key
  `AUTH_STORAGE_KEY` (`lib/supabaseConfig.js`). On page load `SupabaseAuthProvider` restores the session and loads the
  account; `ready` is false meanwhile, and `RequireAuth`/`Login` show "Signing you in…" instead of redirecting. Without
  a stored session the supabase-js chunk isn't loaded at all (`hasStoredSession()`). Sign out (or a revoked session)
  clears it. The demo account's credentials are kept too (`netflix-clone-demo`, dropped after `expiresAt`). Memory mode
  still resets on reload. Use `readStored`/`writeStored` (they tolerate blocked storage) for anything else kept in the
  browser. `LibraryProvider` is keyed by the auth session.
- **Two auth backends, one interface**: `lib/supabaseConfig.js` picks `SupabaseAuthProvider` when the Supabase env is
  set, else `MemoryAuthProvider`; `VITE_AUTH_BACKEND=memory` forces memory (the main e2e build). Auth actions are
  async and resolve to an error message or null (`signup` to `{ error, confirmEmail? }`); pages await them. Keep both
  providers' behaviour and messages in step. LibraryProvider gets `library` (the libraryApi for the signed-in user, or
  null) from the auth context and writes through it.
- **Edge Functions** (`supabase/functions`, `verify_jwt = false`, callers checked in `_shared/supabase.ts`) do what
  the browser must not: create demo accounts, delete account access (ban + revoke sessions, data kept), apply promo
  codes (valid codes are in `public.promotions`, which clients can't read) and count referral clicks. The public ones
  are rate limited per IP with `allowRequest()` (demo accounts: 20/hour per IP, 300/hour overall; referral clicks:
  one per IP per link per hour); old hits are deleted hourly by cron. Call them with
  `callFunction()`. Every PostgREST UPDATE/DELETE needs a filter (`.eq('id', …)`), or PostgREST rejects it.
- **Catalog (Supabase)**: `CatalogProvider` renders the built-in `data/catalog.js` at once, then swaps in the
  `titles` rows from the REST API; on any error it keeps the built-in list. Read titles through `useCatalog()`
  (`titles`, `all`, `findTitle`, `genres`), never by importing `catalog` in a page. Watch progress (and, in memory
  mode, sample reviews) still come from `catalog.js`; with Supabase, `useReviews` reads members' reviews from the
  `review` table. Adding a title: add it to `catalog.js`, regenerate `…_seed_titles.sql`, apply it.
- **TMDB**: the `tmdb` Edge Function calls The Movie Database with the `TMDB_API_FREE` secret (a v3 API key or v4
  read token; set it on each project) and returns titles in the catalog's shape, with `source: 'tmdb'` and a
  `path` of `/tmdb/:type/:tmdbId` (PosterCard links there). Actions: `lists` (new — movies now playing and TV on the
  air — trending and popular, for Home's rows and for Search with no query), `search` (Search with a query) and
  `title` (the TMDB page, with `trailer` — a YouTube key — and `providers`, U.S. stream/rent/buy services from
  JustWatch), `recommendations` (More Like This, Home's Because You Saved) and `save`. Its per-IP limit (600/hour) counts only requests its in-memory cache can't answer. Search's
  genre chips also match TMDB's combined names ("Sci-Fi & Fantasy", "Action & Adventure", "Science Fiction"). Catalog
  titles aren't matched to TMDB: they're fictional, so any name match is an unrelated real title. A member can save a TMDB
  title to My List or Favorites: the function's `save` action upserts it into `titles` (`source = 'tmdb'`, id
  `tmdb-<movie|show>-<id>`) and `tmdb_titles` from TMDB's own data, so the existing foreign keys work. The catalog
  request reads `source = 'catalog'`; saved TMDB rows load separately and only `findTitle` sees them (My List,
  Favorites, reviews). TMDB titles can't be played, but members rate and review them through the shared
  `components/Reviews.jsx` (its `beforeSave` stores the title first). List, search and recommendation items carry
  real U.S. certifications: the function looks each one up once and keeps it in `tmdb_certifications` (30 days;
  'NR' when TMDB has none, which restricted profiles don't see). Trailers embed from `youtube-nocookie.com` only
  after "Play trailer"; keep the JustWatch credit next to Where to watch. Without Supabase or on any error the TMDB sections just don't render. Keep the
  `TmdbCredit` notice wherever TMDB data shows (TMDB's terms). Home has no catalog "new" row any more (New on TMDB
  replaced it); `isNew` still drives New & Hot. Top 10 is TMDB's ten trending movies and shows (alternating), numbered by
  place; the featured carousel is TMDB's five most popular movies and shows (More Info instead of Play; My List stores
  the title first via `state/useStoreTitle.js`). Both fall back to the catalog (`top10`, `popularity`) without TMDB,
  as in CI; specs about the catalog's own Home use `test.use({ tmdb: 'fail' })`.
- **TMDB in Spanish**: the hooks in `state/useTmdb.js` send the interface language; with Spanish the `tmdb` function
  gets `language: 'es'` and asks TMDB for `es-MX` (titles, overviews, season and episode names; cache keys include the
  language). Genre names stay English (the app translates them, and Search matches on them), and `save` always stores
  English, since the `titles` row is shared. Without the `language` field the function answers in English as before.
- **Rows**: horizontal rows use `components/Row.jsx` (title, ‹ › buttons that page by 85% of the width, quick clicks
  add up, `aria-disabled` at the ends, hidden when the row fits).
- **Supabase security**: new `public` tables get no anon/authenticated grants by default (migration
  `…_supabase_auth_support`), so every migration grants only what its RLS policies need and enables RLS. Use the
  publishable key in the browser, never the secret/service_role key. Run `get_advisors` after schema changes, and update
  `schema.sql`, `supabase/diagram/erd.html` (then redraw `drawsql.png`) and `user_stories.md` to match. If the MCP
  server cancels a DELETE/DROP statement (it can't always show its confirmation), give it to the user to run in the
  dashboard SQL editor; migrations containing them have gone through `apply_migration`. A safety hook blocks any
  shell command containing the word "secret": keep it out of commit messages typed on the command line.
- **Demo account**: "Use demo account" on `/login`. In memory mode it's `alex@example.com` with a random password per
  page load; with Supabase the `demo-account` function creates a private account per visitor (random email and
  password, deleted after 24 hours by the `delete-expired-demo-accounts` cron job). Either way the password is shown on
  `/login` and in Account → Change password, so the demo user can change it or confirm deleting the account; never
  hardcode credentials. Billing is simulated: store only card brand, last four and expiry, never full numbers or CVC.
- **Forms**: use `components/Field.jsx`; validate on submit, then `focusFirstError(form)`; errors use `--error`
  (`#e87c03`), never the red accent.
- **Passwords**: new passwords go through `passwordProblem()` / `PASSWORD_HINT` in `state/authContext.js`: 13+
  characters with lowercase, uppercase, a digit and a symbol — the same rules as Supabase Auth on both projects and
  in `supabase/config.toml`. Change all three together. Supabase also rejects leaked passwords (`weak_password`,
  reason `pwned`). Test passwords must meet the rules too (e.g. `Brand-new-pass-42`).
- **Password reset**: `requestPasswordReset` → email link → `/reset-password` → `beginPasswordReset` (Supabase: the
  recovery session in the URL hash; memory: a `?demo_token=` link the page shows instead of an email) →
  `completePasswordReset`, which signs out and leaves a notice for `/login`. The page strips the token from the URL.
  Supabase's Auth → URL Configuration must allow `<site>/reset-password` as a redirect URL.
- **Accessibility menu**: settings live in `AccessibilityProvider` (above the routes, so they work signed out and survive
  sign-in, but reset on reload while signed out). With Supabase they're also saved per member (`accessibility_settings`,
  `data/accessibilityApi.js`): saved settings apply at sign-in, or the current ones are saved the first time. It mirrors them onto `<html>` as `data-a11y-*` attributes styled at the end of
  `index.css`; text size uses CSS `zoom` on `.page`, and contrast/saturation use a `filter` on `<html>` (the only element
  whose filter doesn't break fixed/sticky children). Add a setting in `accessibilityContext.js` (defaults, choices or
  switches, profiles), then style its attribute.
- **Video**: `public/media/` holds three short open-movie excerpts (Sintel, Tears of Steel, Elephants Dream; Blender
  Foundation, CC BY) as WebM + MP4, with English `.vtt` captions from Wikimedia Commons (CC BY-SA 4.0) re-timed to each
  excerpt. `data/clips.js` maps every catalog title to a clip and holds the credits; the player shows them and the Legal
  hub lists them under "Media credits" (CC BY requires attribution, so keep both). The `<track>` is kept `hidden` and
  `Player.jsx` draws the active cue itself. `e2e/serve.js` answers byte-range requests, which browsers need to seek
  video. Playwright's Chromium only plays WebM, so keep the WebM source first. Autoplay
  previews (`usePreview`) start only when `preferences.autoplayPreviews` is on **and** motion is allowed
  (`useMotionAllowed`: no reduced motion, no "Stop animations"); every preview has a pause/play toggle. Volume: a slider beside Mute (0 = muted; unmuting from 0 goes to
  50%), ↑/↓ change it by 10% while focus is in the player, and the level is kept with `writeStored('netflix-clone-volume')`; for a signed-in member it's also saved as
  `preferences.playerVolume` (`player_volume`, 0–100) and wins on their other devices. TV shows get Previous/Next
  episode buttons (Shift+P / Shift+N); episodes are simulated with the same sample clip.
- **Continue Watching**: the player saves `{ percent, episode, seconds }` through `LibraryProvider.saveProgress` on
  pause, on close and every 15 seconds (not before 5 seconds in); with Supabase it's a `watch_progress` row per title.
  Reaching `FINISHED_PERCENT` (95) removes a movie; finishing an episode saves the next one at 0. Home lists
  `progress` newest first and Resume picks up there. In memory, progress starts from `catalog.js`'s sample `progress`.
- **Leaderboards**: `components/Leaderboard.jsx` under each game. Opt-in (`preferences.showOnLeaderboards`,
  `show_on_leaderboards`, default off; also in Account → Privacy). With Supabase it calls the security-definer
  `public.game_leaderboard(game)` (top ten, first names only, 'memory' ranks fewest moves first); in memory,
  `data/leaderboards.js` has sample players.
- **Delete account**: needs `billing.status === 'cancelled'`, the typed email and the account password; it removes
  access only (Supabase: `delete-account` bans the user and sets `access_removed_at`; memory: drops the account). Data
  removal is a support ticket, `/info/report-issue?type=data-removal`. The sign-in notice comes from `notice` in the
  auth provider, because signing out redirects before a navigation state could arrive.
- **Profiles**: an account has 1–5 profiles (a trigger enforces it); watch list, favorites, reminders, watch progress,
  game scores, history, custom lists and recent searches belong to the watching profile through a composite FK
  `(profile_id, user_id) → profiles(id, user_id)`; `private.default_profile()` fills a missing profile_id with the
  account's first profile. The chosen profile is remembered per device (`netflix-clone-profile`); `RequireProfile`
  keys `LibraryProvider` by `${session}:${profile.id}`, and `useCatalog()` filters by the profile's maturity.
- **Support dashboard**: staff are rows in `public.staff` (add them in the SQL editor); they read the queue through
  `staff_tickets()` / `staff_set_ticket_status()`. `ticket_replies` gets `from_staff`/`author_name` from a trigger.
  In memory the demo account is staff and answers its own reports.
- **Notifications**: worked out in the browser (`data/notifications.js`): released reminders (`reminders.release_date`)
  and staff replies newer than `profiles.notifications_seen_at`, which opening `/notifications` updates.
- **Viewing history and privacy**: the player records a viewing as it saves progress (`recordViewing`, one row per
  profile, title, episode, day). `preferences.keep_viewing_history = false` makes the database drop new history and
  recent searches (`private.skip_paused_history`); `history_retention_days` (90/365) is enforced by a nightly cron.
- **Custom lists**: owner-only; `shared_list(slug)` (anon) returns a public list's name, description, profile name
  and title ids. In memory, share links work until a reload (`memorySharedLists`).
- **Watch party**: `/party/:code` over the private Realtime channel `party:<code>` (RLS on `realtime.messages`:
  members of a live party only; call `supabase.realtime.setAuth()` first). Events: `sync`, `hello`/`state` (catching
  up), `chat`; presence lists who's there. In memory it's a `BroadcastChannel` between tabs and the invite link
  carries the title (`?t=`). The Player's `party`, `onUserAction` and `controlRef` props do the syncing.
- **Search**: `search_titles(query)` (pg_trgm word similarity, threshold 0.4) ranks close spellings; `data/fuzzy.js`
  does the same in memory. `components/SearchBox.jsx` is the combobox (suggestions from `data/searchSuggestions.js`,
  recent searches per profile in `recent_searches`, last ten).
- **Installable app**: `public/sw.js` (shell + hashed assets cached; network-first pages; leaves /media, other origins
  and non-GET alone) is registered in production builds (`lib/pwa.js`); the install prompt is in Account → App.
  Bump `VERSION` in sw.js when its caching rules change. Playwright blocks service workers except in `pwa.spec.js`.
- **Thumbs ratings**: `title_reactions` per profile (`dislike`/`like`/`love`), `components/TitleReaction.jsx` on both
  title pages, helpers in `data/reactions.js`. Loves, then favorites, then likes seed Because You Liked; `notDisliked`
  filters every recommendation row (not Continue Watching or Top 10) and the assistant's candidates.
- **Player extras**: `data/clips.js` gives each clip `recap`/`intro` ranges (Skip Recap from episode 2, Skip Intro;
  key S), an `outro` range (the clip's last 6 s; Skip Outro on every title, movies too: `finishNow` pauses, jumps to
  the end and records the title finished, so a show's next-episode countdown starts; dragging the seek bar to its end,
  which moves in whole seconds and so stops short of the clip's, does the same via `scrubTo`) and `chapters`; seek previews come from `public/media/<clip>.thumbs.jpg`, drawn by
  `node scripts/thumbnails.mjs` (re-run it when a clip changes; `THUMBS` in clips.js must match). Picture-in-picture
  (key I) sits beside Close: the controls row is full at 390px. Full screen on a phone or tablet (`isMobileDevice`:
  `userAgentData.mobile` or `(pointer: coarse)`) locks the screen to landscape from the `fullscreenchange` handler, so
  the button, F and the browser's own control all do it; it unlocks when full screen ends. Browsers that can't lock
  (iPhone Safari, which doesn't offer element full screen anyway) refuse quietly. Tests stub `ScreenOrientation`.
- **Rows** (`Row`, `.rail`) scroll sideways only (`overflow-y: hidden`): the Top 10's numbers reach below their cards,
  and without it that row scrolled up, down and diagonally.
- **Profile locks / Kids**: PIN hashes live in `private.profile_pins`; `profiles.locked` changes only through
  `set_profile_pin()` (a trigger keeps it otherwise). `unlock_profile()` returns `ok`/`wrong`/`locked` (five wrong →
  15 minutes). `ProfileProvider` keeps unlocked profiles until another is chosen and never remembers a locked one per
  device; `components/GrownUpGate.jsx` asks for the account password on Kids profiles (Account, profile settings).
  `verify_account_password()` (10 per 15 minutes) also backs Change password with Supabase: signing in again would
  replace the session and need a two-step code.
- **Two-step sign-in**: Supabase Auth MFA (TOTP; on in `config.toml` and on both projects). With a verified factor a
  password sign-in or restored session is aal1: the provider sets `secondStep` and Login asks for the code
  (`verifySecondStep`). A restrictive policy "Two-step sign-in finished" on every RLS table (`second_step_done()`)
  blocks aal1 sessions; give new tables the same policy, and start any security-definer function that reads other
  members' rows with a `second_step_done()` check (RLS doesn't apply inside it). `callerFrom()` in the functions
  refuses them too. Memory mode uses `data/totp.js` (the tests compute codes with it). Devices: `my_sessions()` /
  `end_session()` over auth.sessions.
- **Assistant**: `supabase/functions/assistant` asks Claude (`claude-haiku-5-5`, structured output via the SDK's Zod
  helper) to pick up to five of the profile's allowed titles; ids it invents are dropped. Signed-in only, 20/hour per
  member and 60/hour per IP. Only the request and liked titles' names are sent. Any failure (or no key, or memory
  mode) falls back to `matchWords()` in `data/assistant.js`, and the page says which answered.
- **Donations** (Stripe, one-time, USD): `process-donation` (signed in, `{ amount, user_id }` in cents, 100–1,000,000;
  user_id must be the caller) creates a card-only PaymentIntent with `metadata.user_id` and returns its
  `client_secret`; the app confirms it with Stripe.js, so card numbers never reach us. `stripe-webhook` checks the
  Stripe-Signature and writes `public.donations` with the service role, one row per PaymentIntent (failed can become
  succeeded, never the reverse; payments without `metadata.user_id` are ignored). Members only read their own rows:
  no insert/update/delete grants or policies, and not even the service role deletes. 20/hour per member, 60/hour per
  IP. Database rules in `supabase/tests/database/donations.test.sql`. The page only needs `VITE_STRIPE_PUBLISHABLE_KEY`
  (a `pk_test_` key on dev; without it, or in memory mode, /donate says donations aren't available and Stripe.js never
  loads). The form remembers the PaymentIntent of an attempt that didn't succeed (declined, or no answer) and asks
  Stripe about it (`retrievePaymentIntent`) before anything else: if it went through after all, that's the donation,
  whatever amount is chosen now; the same amount confirms it again (one intent and one row, even after a decline); a
  new amount gets a new intent. So no retry can charge twice. `processing` shows "being processed", not a failure.
  The round coffee link (`.donate-fab`, "Donate: buy us a coffee") sits inside `.bottom-nav`,
  absolutely positioned above it, so it is covered by the tab bar's axe audit (wide screens: fixed bottom right); the
  bottom `scroll-padding` leaves room for it. `donate.spec.js` pays with Stripe test cards 4242… and 4000…0002 on :4174.
- **Donation history and receipts**: /donate lists the member's donations (`DonationHistory`, read straight from
  `donations`; it rechecks a few times after a donation while the webhook records it). `process-donation` sets
  `receipt_email` to the member's address, except for demo accounts (`app_metadata.demo`); Stripe sends no receipts in
  test mode.
- **Surprise me**: `components/SurpriseButton.jsx` on Home (follows the TV Shows / Movies chip) and Search (follows
  Type) opens a random title the profile may watch (`data/surprise.js`: never Not for me, never the last pick): the
  catalog's, plus the movies and TV shows in TMDB's lists (`listedTitles()` in `data/tmdbApi.js`, without Coming Soon;
  restricted profiles get only those certified within their setting). Without TMDB it picks from the catalog alone.
  `e2e/tmdbMock.js` gives every listed title a page, so any pick opens.
- **Keyboard shortcuts help**: `?` on any page (not while typing) opens `components/ShortcutsDialog.jsx`, also from
  the accessibility menu and the Accessibility Policy. The list is `data/shortcuts.js`: change it with the handlers
  (Player's `shortcuts`, SearchBox).
- **Screen-time limits**: `profiles.daily_limit_minutes` (30–240, null = none) changes only through
  `set_screen_time_limit()` with the account password (a trigger keeps it otherwise, like `locked`). Only limited
  profiles count time: `state/useScreenTime.js` adds 5 s per tick while the player plays and saves every 15 s through
  `add_screen_time()` (1–60 s per call, never down; `screen_time` per profile and local day). At the limit the player
  pauses under `components/ScreenTimeUp.jsx`; `add_extra_screen_time()` (password) allows 30 more minutes. Set it in
  Profiles → Edit → Screen time. In memory the usage lives for the page load.
- **Caption language**: `captionLanguage` ('en' | 'es') in the accessibility menu (saved as
  `accessibility_settings.caption_language`); the Player keys its `<track>` by language
  (`public/media/<clip>.<lang>.vtt`). The Spanish files are this app's translation of the CC BY-SA English captions:
  keep the credit in the player and the Legal hub.
- **Offline downloads**: `data/downloads.js` puts a title's clip (the format this browser plays), both caption files
  and the seek previews in the `downloads` cache; `public/sw.js` answers `/media` from it, byte ranges included, and
  never deletes that cache. The list is per device (`netflix-clone-downloads`). Offered only when a service worker
  controls the page (production builds), so `pwa.spec.js` is where it's tested.
- **Reported reviews**: members report another member's review (`review_reports`; a trigger copies the review and
  refuses your own; one per member per review). The support dashboard's Reported reviews view uses
  `staff_review_reports()` / `staff_resolve_review()` (keep, or delete the review; reports stay marked Removed). In
  memory the sample reviews can be reported and the demo account settles them (`data/reviewReports.js`).
- **Helpful votes**: `review_helpful_votes` (one per member per review; a trigger refuses your own review) and
  `review.helpful_count`, kept by triggers only (a guard trigger refuses direct changes). `components/Reviews.jsx` shows
  Helpful (`aria-pressed`) under others' reviews and Sort reviews (Most helpful, Newest; `data/helpfulVotes.js`). A
  duplicate vote (23505, another tab) counts as done. In memory the votes live for the page load.
- **Weekly screen time**: Profiles → Edit → Screen time lists the last 7 days for a limited profile
  (`useScreenTimeWeek()` in `state/useScreenTime.js`, `lastSevenDays()` / `weekOf()` in `data/screenTime.js`, read
  with `loadScreenTimeSince()`), with bars against the limit, the total and the daily average. `screen_time` rows older
  than a week are deleted nightly, so 7 days is all there is.
- **Staff donations**: the support dashboard's Donations view reads `staff_donation_months(p_months)` (totals,
  paid and failed counts per month) and `staff_recent_donations(p_status)` (with a `monthly` flag), both
  security definer with the staff and `second_step_done()` checks; each row links to the payment in Stripe
  (`stripePaymentUrl()`, test or live dashboard). Members still read only their own donations. In memory it shows
  `sampleDonations()` (`data/staffDonations.js`).
- **Audio description**: `audioDescription` in the accessibility menu (saved as
  `accessibility_settings.audio_description`), the player's AD button or the D key. The Player loads
  `public/media/<clip>.<lang>.descriptions.vtt` as a `kind="descriptions"` track in the caption language and
  `state/useAudioDescription.js` reads each cue with `speechSynthesis`, pausing the video while it speaks (extended
  description). Downloads include the description files. Tests stub `speechSynthesis`.
- **Monthly donations** (Stripe subscriptions, USD): `monthly-donation` (signed in) with `{ action: 'start', amount,
  user_id }` creates a subscription and returns the first invoice's payment for Stripe.js to confirm (the same card
  form as one-time donations); `{ action: 'cancel' }` cancels it at once. One live monthly donation per member (a
  unique partial index; an unpaid one is replaced on a new start). `monthly_donations` mirrors the subscription and is
  written only by the functions: `stripe-webhook` records each paid or failed invoice as a `donations` row with
  `monthly_donation_id` and keeps the status in step (`customer.subscription.updated` / `.deleted`). Demo accounts'
  subscriptions get `cancel_at_period_end` (never charged twice), and `delete-account` stops a member's monthly
  donation before removing access. Members read only their own row. "Your monthly donation" (amount, next payment,
  Cancel with a confirm step) is on /donate and in Account; the history marks monthly payments.
- **Spanish interface**: `language` ('en' | 'es') in the accessibility menu (saved as
  `accessibility_settings.language`; a Spanish browser starts in Spanish; Reset keeps it). English text is the key:
  components call `useT()` (`t('Text {name}', { name })`), helpers and data files `tr()`, dates and numbers `locale()`
  (`src/i18n/index.js`); dictionaries are `src/i18n/es/<area>.js`. A missing text falls back to English.
  `AccessibilityProvider` sets the language during render and `<html lang>`. `scripts/i18n-check.mjs` (part of
  `npm run lint`) fails on a `t()`/`tr()` text with no Spanish entry. Titles, synopses, reviews and the legal
  documents stay in English; label tests by role and exact name, as Spanish labels differ.
- **Phone frame**: on desktop `.phone` is a flex column and `.page` grows, so the footer and sticky tab bar sit at the
  frame's bottom on short pages too (`layout.spec.js` checks it in a tall window).
- **Form state**: update with functional setters and read `e.target.value` before them
  (`(e) => { const { value } = e.target; setForm((f) => ({ ...f, key: value })) }`): with transitions pending, a
  spread of the render's `form` can restore an older value.
- **Copy to clipboard**: use `useCopyToClipboard` — it handles a missing/blocked clipboard by showing the text.
- **Non-component exports** go in `.js` files, not next to components (React Fast Refresh lint rule).
- **Names**: hooks only for real hooks (`use*`); handlers are verbs (`applyCode`, `goToNextRound`).

## Design rules (from `app_outline/style_guide.md`)

- Designed for a 390px phone; from 600px the app fills the screen (more columns), and from 1024px (`useWideScreen`,
  keep in step with index.css) a top bar replaces the tab bar. `layout.spec.js` sweeps every page at 320–1920px; the
  layout, browse and i18n specs also run on `tablet` and `firefox` projects. Safari (WebKit) is
  deliberately not tested: installing its system libraries made CI hang.
- One accent (`--accent: #e50914`) for primary actions; error orange is distinct.
- Touch targets ≥ 44px (use a `::before` hit area if the visual must be smaller); visible focus; labels on every input.
- Motion is subtle and disabled under `prefers-reduced-motion`; no auto-advancing carousels (WCAG 2.2.2).
- WCAG 2.2 AA is enforced by `e2e/a11y.spec.js` (axe-core) — keep it green.
- Every page header has the accessibility menu button; the footer links the Accessibility Policy.
- Destructive actions use `.delete-fill` (darker red `#c40812`), separate from the accent and the error orange.

## Testing

- Every change should keep `npm run lint`, `npm run test:e2e` and the pgTAP tests green; CI runs all three.
- The pgTAP tests pin each table's exact columns (`columns_are`): a migration that adds a column must add it to that
  table's test too, or the `database` job fails with "Extra columns" (as `donations.monthly_donation_id` did).
- Tests sign in once with `signInAsDemo()` and move with `navigateInApp()` (client-side), because a reload logs out on
  the in-memory build (the Supabase build stays signed in; `supabase-auth.spec.js` checks that).
- Most specs run on the in-memory build (:4173). `e2e/supabase.spec.js` (REST catalog) and `e2e/supabase-auth.spec.js`
  (real sign-in, saved data, Edge Functions; desktop only, on :4174) use the dev project and skip without
  `.env.development.local` (as in CI). Keep Supabase sign-ins in tests few: Auth rate-limits them per IP.
- New features get a spec: `e2e/features.spec.js` (carousel, billing, affiliate…) and `e2e/accessibility.spec.js`
  (accessibility menu, policy, player and captions, autoplay, delete account); TMDB features go in `e2e/tmdb.spec.js`; Continue Watching is in `features.spec.js`, leaderboards in `games.spec.js`.
  Specs import `test` from `e2e/test.js`, which mocks the `tmdb` function on every page (`e2e/tmdbMock.js`; call
  `mockTmdb(page, { fail: true })` to override), and YouTube's embed answered with an empty page, so the suite never uses TMDB or its per-IP limit — real calls from
  test runs once locked the developer's own browser out for an hour.
- Navigations are transitions: after a click that changes page, wait for something on the new page (its heading),
  not just the URL, before navigating again, or the old page can stay mounted.
- Specs for the ten features: `profiles.spec.js`, `support.spec.js`, `lists.spec.js`, `party.spec.js` (two tabs),
  `search.spec.js`, `pwa.spec.js`; people, episodes and history are in `features.spec.js`, TMDB people, seasons and
  release reminders in `tmdb.spec.js`; `supabase-auth.spec.js` checks lists and watch parties against the dev project.
- The seven after that: thumbs ratings, Year in Review and the assistant in `features.spec.js`; skips, chapters, seek
  previews and picture-in-picture in `accessibility.spec.js`; PINs and Kids in `profiles.spec.js`; two-step sign-in and
  devices in `auth.spec.js`; all of them against the dev project (real TOTP) in `supabase-auth.spec.js`; database rules
  in `supabase/tests/database/seven_features.test.sql`.
- The eight after that: donation history in `donate.spec.js`; Surprise me in `features.spec.js`; shortcuts help and
  Spanish captions in `accessibility.spec.js`; screen-time limits in `profiles.spec.js` (Playwright's fake clock);
  downloads in `pwa.spec.js`; reported reviews in `support.spec.js`; database rules in
  `supabase/tests/database/eight_features.test.sql`.
- The six after that: helpful votes in `features.spec.js`; the weekly screen time in `profiles.spec.js` (fake clock);
  the Donations view in `support.spec.js`; audio description in `accessibility.spec.js` (speech stubbed, waiting for
  the track's cues); monthly donations in `donate.spec.js` (mocked, plus a real test-mode start and cancel on :4174);
  the Spanish interface in `i18n.spec.js` (including an `es-MX` browser); database rules in
  `supabase/tests/database/six_features.test.sql`.
- Header buttons are matched by exact name in tests (`'Accessibility menu', exact: true`), since "Close accessibility
  menu" also contains it.

## Environment gotchas

- **Console Ninja (VS Code extension) can hang `vite`**: it injects a hook into
  `node_modules/vite/bin/vite.js`. If `npm run dev` stalls after "Console Ninja extension is connected", restore
  the file with `npm install --force vite` and disable the extension for this workspace.
- The Playwright MCP browser is shared and sometimes zoomed; prefer `npx playwright test` for verification.
