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
                      billing, preferences), LibraryProvider (lists, ratings, scores, tickets…), useReviews,
                      AccessibilityProvider (accessibility menu settings)
  src/pages/          One file per route; info/, games/ and account/ hold sub-pages
  src/components/     Layout (phone frame, tab bar, footer), PageHeader, Field, Player, Preview, AccessibilityPanel, hooks
  e2e/                Playwright specs, serve.js (static server), ports.js (ports + dev project config)
  .env.example        Copy to .env.development.local (dev project) and .env.production.local (production); git-ignored
supabase/             Supabase CLI project (config.toml); MCP config in supabase/.mcp.json (not committed)
  migrations/         Schema + RLS, catalog titles, auth support (triggers, promotions, cleanup cron), rate limits
  non_transactional/  CREATE INDEX CONCURRENTLY files: apply with psql after migrations (the CLI can't run them)
                      (Index Advisor is installed on both projects: dashboard → Query Performance suggests missing ones)
  functions/          Edge Functions: demo-account, delete-account, apply-promo, record-referral, tmdb (+ _shared/: clients,
                      CORS, caller check, per-IP rate limits via public.hit_rate_limit); hello and multiply are
                      standalone public test endpoints
  seeds/              Development test data (6 example.com users, rows in every table); never run on production
  tests/database/     pgTAP tests (`supabase test db`): access rules, triggers, cleanup job, rate limiter, indexes
  diagram/            erd.html (source of drawsql.png) + render.mjs (`node supabase/diagram/render.mjs` redraws it)
schema.sql, drawsql.png  The table design and its diagram, kept in step with the migrations (all 16 public tables)
user_stories.md       What the database stores, one story per thing the app remembers
prompt.md             The original build prompt and the Supabase-phase prompts
.github/workflows/    CI: lint, build, Playwright; pgTAP against a local Supabase (Docker)
```

Supabase projects (org "Zuleika LLC", Pro plan): **eagle_platoon** `czgzptjegmkvrxnxduxs` = production,
**eagle_platoon_dev** `cfcbhwwpslgxjpijdnfy` = development and e2e tests (has the seed data). Apply every migration,
non_transactional file and function to dev first, then production, with the same migration version on both.
Both run the same 6 migrations and 7 functions (production caught up on 2026-10-20). `apply_migration` stamps the
current time as the version: afterwards set it to the file's version in `supabase_migrations.schema_migrations`.
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
  `title` (the TMDB page). Its per-IP limit (600/hour) counts only requests its in-memory cache can't answer. Search's
  genre chips also match TMDB's combined names ("Sci-Fi & Fantasy", "Action & Adventure", "Science Fiction"). Catalog
  titles aren't matched to TMDB: they're fictional, so any name match is an unrelated real title. TMDB titles aren't
  `titles` rows, so they can't be played, saved or reviewed; list and search items are rated 'NR', so restricted
  profiles don't see them. Without Supabase or on any error the TMDB sections just don't render. Keep the
  `TmdbCredit` notice wherever TMDB data shows (TMDB's terms). Home has no catalog "new" row any more (New on TMDB
  replaced it); `isNew` still drives New & Hot.
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
  (`useMotionAllowed`: no reduced motion, no "Stop animations"); every preview has a pause/play toggle.
- **Delete account**: needs `billing.status === 'cancelled'`, the typed email and the account password; it removes
  access only (Supabase: `delete-account` bans the user and sets `access_removed_at`; memory: drops the account). Data
  removal is a support ticket, `/info/report-issue?type=data-removal`. The sign-in notice comes from `notice` in the
  auth provider, because signing out redirects before a navigation state could arrive.
- **Copy to clipboard**: use `useCopyToClipboard` — it handles a missing/blocked clipboard by showing the text.
- **Non-component exports** go in `.js` files, not next to components (React Fast Refresh lint rule).
- **Names**: hooks only for real hooks (`use*`); handlers are verbs (`applyCode`, `goToNextRound`).

## Design rules (from `app_outline/style_guide.md`)

- Designed for a 390px phone; on desktop the app sits in a centered phone frame that scrolls internally.
- One accent (`--accent: #e50914`) for primary actions; error orange is distinct.
- Touch targets ≥ 44px (use a `::before` hit area if the visual must be smaller); visible focus; labels on every input.
- Motion is subtle and disabled under `prefers-reduced-motion`; no auto-advancing carousels (WCAG 2.2.2).
- WCAG 2.2 AA is enforced by `e2e/a11y.spec.js` (axe-core) — keep it green.
- Every page header has the accessibility menu button; the footer links the Accessibility Policy.
- Destructive actions use `.delete-fill` (darker red `#c40812`), separate from the accent and the error orange.

## Testing

- Every change should keep `npm run lint`, `npm run test:e2e` and the pgTAP tests green; CI runs all three.
- Tests sign in once with `signInAsDemo()` and move with `navigateInApp()` (client-side), because a reload logs out on
  the in-memory build (the Supabase build stays signed in; `supabase-auth.spec.js` checks that).
- Most specs run on the in-memory build (:4173). `e2e/supabase.spec.js` (REST catalog) and `e2e/supabase-auth.spec.js`
  (real sign-in, saved data, Edge Functions; desktop only, on :4174) use the dev project and skip without
  `.env.development.local` (as in CI). Keep Supabase sign-ins in tests few: Auth rate-limits them per IP.
- New features get a spec: `e2e/features.spec.js` (carousel, billing, affiliate…) and `e2e/accessibility.spec.js`
  (accessibility menu, policy, player and captions, autoplay, delete account); TMDB features go in `e2e/tmdb.spec.js`.
  Specs import `test` from `e2e/test.js`, which mocks the `tmdb` function on every page (`e2e/tmdbMock.js`; call
  `mockTmdb(page, { fail: true })` to override), so the suite never uses TMDB or its per-IP limit — real calls from
  test runs once locked the developer's own browser out for an hour.
- Header buttons are matched by exact name in tests (`'Accessibility menu', exact: true`), since "Close accessibility
  menu" also contains it.

## Environment gotchas

- **Console Ninja (VS Code extension) can hang `vite`**: it injects a hook into
  `node_modules/vite/bin/vite.js`. If `npm run dev` stalls after "Console Ninja extension is connected", restore
  the file with `npm install --force vite` and disable the extension for this workspace.
- The Playwright MCP browser is shared and sometimes zoomed; prefer `npx playwright test` for verification.
