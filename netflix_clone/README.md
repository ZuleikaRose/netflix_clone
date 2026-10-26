# Netflix Clone

A mobile-first streaming app built with React 19, Vite and React Router (`BrowserRouter`) on Supabase. It was built in phases from the wireframes, user journey and style guide in `../app_outline`, then connected to Supabase (catalog from the REST API, Supabase Auth, member data in Postgres; see `../supabase`). Real trending, popular and searchable movies and TV shows come from [TMDB](https://www.themoviedb.org) through the `tmdb` Edge Function, which keeps the TMDB key on the server.

**You stay signed in after a refresh**: with Supabase the session is kept in the browser (`localStorage`) until you sign out, and your list, ratings, reviews and settings load back from the database. The app talks to Supabase through its REST APIs (Data API `/rest/v1`, Auth `/auth/v1`, Edge Functions `/functions/v1`) via `supabase-js`. Without Supabase configured the app falls back to the built-in catalog and in-memory accounts, and a refresh resets everything.

## Run it

```bash
npm install
cp .env.example .env.development.local   # dev project URL + publishable key (optional)
npm run dev      # http://localhost:5173
npm run lint
npm run build    # uses .env.production.local (production project) when present
```

| Env file | Used by | Project |
| --- | --- | --- |
| `.env.development.local` | `npm run dev`, the Supabase e2e build | eagle_platoon_dev |
| `.env.production.local` | `npm run build` | eagle_platoon |
| (none) | CI, or `VITE_AUTH_BACKEND=memory` | built-in catalog, in-memory accounts |

Both files are git-ignored; use only the publishable key (`sb_publishable_…`), never the secret key.

On the sign-in screen, choose **Use demo account**, or create an account with **Sign up**. With Supabase, the demo button creates a private account for you (random email and password, deleted after 24 hours); in memory mode it's `alex@example.com` with a random password per page load. Either way the password is shown under the demo button and in Account → Change password.

New passwords need 13+ characters with lowercase, uppercase, a digit and a symbol (e.g. `Brand-new-pass-42`); Supabase also rejects passwords found in data leaks. **Forgot your password?** on `/login` emails a reset link (in memory mode the page shows the link instead).

### Demo data for trying features

| Feature | Try |
| --- | --- |
| Payment method (Account → Billing) | Test cards `4242 4242 4242 4242` (Visa) or `5555 5555 5555 4444` (Mastercard), any future expiry, any 3-digit code |
| Promo codes (Promotions & Discounts) | `WELCOME50`, `STUDENT20`, `FAMILY15` (Premium plan only); with Supabase the `apply-promo` function checks them |
| Affiliate Program | Join with any `https://` URL. In memory mode, **Simulate a sign-up** counts referrals (11 sign-ups reaches the Pro tier); with Supabase, real clicks and sign-ups on your link are counted |
| Forgot password | `/forgot-password`. With Supabase the link arrives by email; in memory mode the page shows a demo link |
| Referral sign-up | `/signup?ref=ALEX26` shows the "invited by a friend" welcome |
| Support chat | Ask about passwords, promo codes or devices; answers come from the FAQs |
| TMDB movies and TV shows | With Supabase configured: Home's *New on TMDB*, Trending and Popular rows (the TV Shows and Movies chips filter them; ‹ › page through each row), Search with no query to browse every listed TMDB title by Type, Released and Sort by, a search such as `breaking bad`, or `/tmdb/show/1399`. On a TMDB page, **My List** and **Favorite** save it (with Supabase sign-in the `tmdb` function stores it first); it then shows in Watch list and Favorites, and Home adds *Because You Saved…*. `/tmdb/movie/603` shows **Play trailer**, *Where to watch in the U.S.*, ratings and reviews, and *More Like This*. The project needs its `TMDB_API_FREE` Edge Function setting; without Supabase the TMDB sections don't appear |
| Maturity filter | Account → Maturity rating → Kids leaves only *Lantern Island* from the catalog; TMDB rows and results keep only titles rated for kids (TMDB titles with no U.S. rating stay hidden) |
| Continue Watching | Play *Behind the Glass*, seek a little way in and close the player: it's first in *Continue Watching* on Home and the title says **Resume**. Finish the episode and the row shows **E2**. Signed in with Supabase, it follows you to other devices |
| Leaderboards | Open any game: its leaderboard is under it. Turn on **Show me on leaderboards** (or Account → Privacy & data) to appear by first name |
| Accessibility menu | The person icon at the top of any page (also on sign-in). Try the *Low vision* or *Dyslexia friendly* profile |
| Captions and player | Every title plays a real sample clip. Press **CC** (or the **C** key) for its English captions; drag the seek bar to the end of a *Night Shift* episode to see Autoplay next episode |
| Autoplay previews | Off by default: Home shows a **Preview** button. Turn on Account → Autoplay previews and previews start by themselves (never under reduced motion or *Stop animations*) |
| Delete account | Account → Danger zone. Cancel the membership in Billing first, then type the account's email and the password shown in Change password. With Supabase this removes access (the `delete-account` function); the demo button makes a new demo account |
| Episodes and volume | Play *Night Shift*: **Previous episode** / **Next episode** (or Shift+P / Shift+N) move between episodes. Set the volume with the slider or ↑/↓; signed in with Supabase, it follows you to other devices |
| Profiles | My Netflix → Profiles → Manage profiles → Add profile; choose maturity *Kids* and the Kids profile sees only *Lantern Island* from the catalog, with its own lists |
| Support dashboard | In memory the demo account is support staff: file a report in Issue Reporting, then Account → Support dashboard to reply and change its status; the reply shows under Your reports and the bell counts it. With Supabase, staff are rows in `staff` (the dev seed makes Dana staff) |
| People | On any title page, click a cast or crew name |
| Episodes | *Night Shift* → Episodes: pick Season 2 and play an episode; the last episode of *The Veil* ends the series |
| Reminders and the bell | With Supabase configured: New & Hot → Coming Soon → Remind Me; the bell lists it under Coming up and announces it on release day |
| Viewing activity | Watch a little of anything, then Account → Viewing activity: hide entries, download a CSV, pause history or set it to delete after 90 days |
| Custom lists | On a title page, **Add to a list** → New list; then My Netflix → My lists → the list → Share with a link, and open the link signed out (in memory, in the same tab until a reload) |
| Watch party | On a catalog title, **Watch party**; open the invite link in a second tab and press play in either |
| Search | Try `nite shift` (a typo), `mara` (a person) or `thril` (a genre); press Enter to keep a search in recent searches |
| Install | Account → App (Chrome and Edge offer **Install Netflix Clone**; iPhone: Share → Add to Home Screen); production builds only |
| Surprise me | Home (under the hero) or Search: opens a random title for the profile, following the Movies / TV Shows filter |
| Keyboard shortcuts | Press **?** on any page (or Accessibility menu → Keyboard shortcuts) |
| Screen-time limits | Profiles → Manage profiles → Edit → Screen time: choose a daily limit and enter the account password. When it's used up the player stops; **Ask a grown-up** allows 30 more minutes with the password |
| Spanish captions | Accessibility menu → Caption language → Español, then turn on CC in the player |
| Downloads | In a production build (`npm run build`, then serve `dist/`), a title page offers **Download to watch offline**; My App → Downloads lists them. Go offline and it still plays |
| Report a review | Under someone else's review on a title page, **Report**. In memory the demo account is staff: Account → Support dashboard → Reported reviews to keep or remove it |
| Seed data (dev project) | Six `@example.com` members (Alex, Jordan, Sam, Priya, Chris, Dana) with lists, reviews, tickets and affiliates, from `../supabase/seeds/` |

### Troubleshooting

If `npm run dev` stalls right after "Console Ninja extension is connected to Vite", the Console Ninja VS Code
extension has injected a hook into `node_modules/vite/bin/vite.js`. Run `npm install --force vite` to restore
the file, and disable the extension for this workspace to stop it coming back.

## Testing

End-to-end tests use [Playwright](https://playwright.dev) and run every journey at phone (390×844) and desktop (1280×800) sizes:

```bash
npx playwright install chromium   # first time only
npm run test:e2e                  # two builds: :4173 in-memory accounts, :4174 Supabase Auth
npm run test:e2e:report           # open the HTML report from the last run
```

| Spec | Covers |
| --- | --- |
| `e2e/auth.spec.js` | Sign-in guard and return path, validation, password rules, sign-up (incl. duplicate email), sign-out, refresh reset, forgot/reset password (memory flow) |
| `e2e/browse.spec.js` | Home rows and filters, title actions (list, favorite, rate, review, play), recommendations, search URL state, maturity filtering, 404 |
| `e2e/help.spec.js` | Every footer link, support chat, FAQ search, feedback and issue forms, promo codes, share fallback |
| `e2e/games.spec.js` | The six games on `/games`; a full Poster Match playthrough; all five Plot Twist rounds; a perfect and a wrong Timeline; Cast Call scoring right and wrong picks; a Higher or Lower streak saved as the best; the opt-in leaderboard (and its Account switch); Title Scramble's empty, wrong, hinted and missed guesses (answers looked up in `src/data/catalog.js`) |
| `e2e/test.js`, `e2e/tmdbMock.js` | Every spec imports `test` from `test.js`, which mocks the `tmdb` Edge Function for every page, so the suite never calls TMDB (no flaky data, no hits on its per-IP limit) |
| `e2e/layout.spec.js` | Every route: heading present, no horizontal overflow, 44px touch targets, no console errors; keyboard focus order |
| `e2e/features.spec.js` | Continue Watching (saved position, Resume, next episode badge), carousel, row ‹ › buttons, service banner, personalization opt-out, crew, release-year filter, Watch list/Favorites routes, billing, affiliate program, referral sign-up, legal hub |
| `e2e/accessibility.spec.js` | Accessibility menu (signed out too, Escape, profiles, reset, no overflow at 150% text, reading guide), Accessibility Policy links, real clip playback and controls, the volume slider and ↑/↓ keys (remembered for the next video and saved to the member), previous/next episode buttons and Shift+P / Shift+N (shows only), captions from the clip's track (button, C key, menu, size), autoplay next episode on/off, autoplay previews vs. Stop animations and reduced motion, delete account (blocked until cancelled, email and password checks, data removal ticket) |
| `e2e/supabase.spec.js` | Catalog from the Supabase REST API, and the built-in fallback when the API is unreachable |
| `e2e/tmdb.spec.js` | Trailer (loads only on request) and where to watch, ratings and reviews of a TMDB title, More Like This and Because You Saved, TMDB titles a restricted profile may see, saving a TMDB title to My List and Favorites (and opening it from there), Top 10 filled from TMDB's trending titles (numbered by place, capped at ten, filtered by the type chips), New on TMDB and the other TMDB rows on Home with the type chips, a TMDB title page (details, no play or save, unknown id), TMDB search results with filters, browsing TMDB titles in Search without a query (Type, Released, Sort by, genre chips), and the app carrying on when TMDB fails |
| `e2e/supabase-auth.spec.js` | Real Supabase sign-in (desktop, :4174): private demo account, staying signed in after a reload (and signed out after Sign out), saved accessibility settings, members' reviews, forgot/reset password with an emailed link, expired link, sign up → promo code → review → delete account |
| `e2e/a11y.spec.js` | [axe-core](https://github.com/dequelabs/axe-core) WCAG 2.2 AA audit of every page and key interactive states (form errors, chat, expanded FAQ, answered trivia, billing errors and cancel confirmation, affiliate form and dashboard, accessibility menu, player with captions and end screen, delete account errors, forgot and reset password); keyboard focus never hidden behind the sticky bars (2.4.11) |

The Supabase specs (and `tmdb.spec.js`, which needs the Supabase build to call the function) skip without `.env.development.local` (as in CI). Keep Supabase sign-ins in tests few: Auth rate-limits them per IP.

CI (`.github/workflows/ci.yml`) runs lint, build and the full suite on every push to `main` and on pull requests, uploads the HTML report as an artifact, and runs the pgTAP database tests against a local Supabase.

Tests serve the built app with `e2e/serve.js`, a tiny static server with SPA fallback and byte-range support (needed to seek video), rather than `vite preview`. Most specs run on the in-memory build, where a full page load signs the user out, so tests sign in once and then use client-side navigation (`navigateInApp()` in `e2e/helpers.js`).

## What's inside

| Area | Routes | Highlights |
| --- | --- | --- |
| Auth | `/login`, `/signup`, `/logout`, `/forgot-password`, `/reset-password` | Supabase Auth (or in-memory accounts); sign-in guard that returns you to the page you wanted; plan picker; strict password rules; password reset by email; accessible inline validation |
| Browse | `/`, `/title/:id`, `/search`, `/new` | Featured carousel with previews, maintenance banner, TV/Movie filters, Continue Watching (saved per member), Top 10, "Because You Liked…" recommendations, player with captions, full controls, Skip Recap / Skip Intro, chapters, seek previews and picture-in-picture, thumbs ratings, ratings & members' reviews, share, URL-driven search filters |
| TMDB | `/tmdb/:type/:tmdbId` | Trending and popular movie and TV rows on Home, TMDB results in Search, and a page per TMDB title (poster, overview, rating, maturity, length, cast, crew, link to TMDB, trailer, where to watch, My List and Favorite, ratings and reviews, More Like This), all through the `tmdb` Edge Function |
| Profiles & people | `/profiles`, `/people/:name`, `/tmdb/person/:personId` | Who's watching (1–5 profiles, Kids, PIN locks; Kids profiles ask a grown-up before settings), actor and director pages |
| Discover | `/what-to-watch`, `/year-in-review` | What should I watch? (Claude via the `assistant` function, or word matching), Year in Review with a shareable summary |
| Together | `/lists`, `/lists/:listId`, `/shared/:slug`, `/party/:code` | Custom lists shareable by link (public page for anyone), watch parties over Supabase Realtime with presence and chat |
| Activity | `/notifications`, `/history`, `/support-dashboard` | Notifications bell (released reminders, support replies), viewing activity with privacy controls, the support team's ticket queue |
| Library | `/my-netflix`, `/watchlist`, `/favorites`, `/account` | Watch list & Favorites pages; profile, password, plan, billing (payment method, billing date, pause, cancel), autoplay, maturity, accessibility and privacy settings, Security (two-step sign-in, signed-in devices), danger zone (delete account) |
| Donate | `/donate` | One-time card donations through Stripe ($5, $10, $25, $50 or $1–$10,000), opened from the round coffee button above the tab bar on every page or from Account, with the member's past donations and an emailed Stripe receipt; the `process-donation` and `stripe-webhook` Edge Functions (dev project for now) |
| Downloads | `/downloads` | Titles saved on this device to watch offline ("Download to watch offline" on a title page; the service worker plays them, seeking included) |
| Games | `/games`, `/games/:gameId` | Poster Match (`memory`), Plot Twist (`trivia`), Timeline (`timeline`), Cast Call (`cast`), Higher or Lower (`higher-lower`) and Title Scramble (`scramble`), with best scores (saved with Supabase) and opt-in leaderboards (first names only) |
| Help & legal | `/info/:slug` | Support hub with live-chat mock, FAQs, Feedback, Issue Reporting, Promotions (working promo codes), Technical Requirements, AI Integration, Affiliate Program (join, referral dashboard, tiered commissions, marketing materials), Legal & Privacy hub, Terms, Privacy, Do Not Sell, Accessibility Policy |

The maturity setting in Account filters every catalog surface: Home, Search, New & Hot, related titles and games.

## Project layout

```
src/
  components/   Layout (tab bar or wide-screen top bar + footer), PageHeader, Field, PosterCard, ShareButton, TmdbCredit,
                useCopyToClipboard, useDocumentTitle, Player, Preview/usePreview,
                AccessibilityPanel, AccessibilityButton
  data/         Catalog, plans, billing, promotions, affiliate program, FAQs, legal copy, service status
                (sample content); catalogApi, accountApi, libraryApi, accessibilityApi (Supabase queries), tmdbApi (the tmdb
                Edge Function)
  lib/          supabaseConfig.js (env, auth backend, lazy getSupabase()), supabase.js (the client)
  pages/        One file per route; account/, info/ and games/ hold the sub-pages
  state/        CatalogProvider (titles), AuthProvider → SupabaseAuthProvider or MemoryAuthProvider (accounts,
                billing, preferences, session), AccessibilityProvider (menu settings), LibraryProvider (list,
                ratings, reviews, watch progress, tickets, affiliate account, dismissed notices), useReviews, useTmdb (TMDB lists,
                search and titles)
e2e/            Playwright specs, helpers, serve.js and ports.js
```

Requirements and the outline-to-route map are in [`../CLAUDE.md`](../CLAUDE.md).

`LibraryProvider` is keyed by the auth session: with Supabase each sign-in loads that member's saved library; in memory mode every sign-in starts empty.

## Design notes

- Spanish: Accessibility menu → Language & translation → Español translates the interface, the catalog's synopses and episode names (`src/i18n/es/content.js`) and, through the `tmdb` function, TMDB's titles and overviews.
- Designed for 390px phones. Tablets (600px+) use the full width with more columns; notebooks, Chromebooks and desktops (1024px+) get a top bar instead of the tab bar and a centred column for text pages. Layout tests cover 320–1920px in Chromium and Firefox (Safari isn't tested).
- One accent color (`#e50914`) for primary actions. Form errors use a distinct orange (`#e87c03`).
- Touch targets are at least 44px, keyboard focus is always visible, and every input has a label. Motion is subtle and turned off under `prefers-reduced-motion`.
- The accessibility menu's settings are applied as `data-a11y-*` attributes on `<html>`. Signed out, they reset on reload; with Supabase, members' settings are saved and applied again at sign-in and after a reload. Its readable and dyslexia-friendly fonts are Atkinson Hyperlegible and Lexend from Google Fonts.

## Caveats

- With Supabase, passwords are stored and checked by Supabase Auth. In memory mode (CI, or no env file) passwords are held in plain JavaScript memory; never reuse that pattern with real data.
- Billing and affiliate payouts are simulated: only a card's brand, last 4 digits and expiry are kept, never the full number or CVC.
- Sample clips (`public/media/`, about 17 MB) are excerpts of the Blender Foundation's open movies *Sintel* and *Tears of Steel* (CC BY 3.0) and *Elephants Dream* (CC BY 2.5), re-encoded to 360p. English captions come from Wikimedia Commons subtitles (CC BY-SA 4.0), re-timed to each excerpt and covering dialogue only. Credits appear under the player and in Legal & Privacy → Media credits.
- Deleting an account removes access only (Supabase: the user is banned and `access_removed_at` set; memory: the account is dropped). Data removal is a support ticket.
- The catalog's titles, synopses, seed reviews and legal text are placeholder content. Its posters reuse four Unsplash photos with CSS color filters; TMDB titles use TMDB's real posters. This product uses the TMDB API but is not endorsed or certified by TMDB.
