# Netflix Clone — project guide

Mobile-first streaming app (React 19 + Vite 8 + React Router 7 `BrowserRouter`). The catalog is read from a
Supabase database over its REST API; everything else is still front-end only, in memory.
Requirements live in `app_outline/`; the app lives in `netflix_clone/`; the database lives in `supabase/`.

## Layout

```
app_outline/          Requirements (source of truth for features)
  user_journey.md     Planning pipeline + 8-question template; §6 lists every required page
  pages/<Page>/       One folder per page; each holds a copy of user_journey.md
  style_guide.md      Visual rules (see "Design rules" below)
netflix_clone/        The Vite app — run all npm commands here
  src/data/           Catalog, plans, billing, promotions, affiliate program, FAQs, legal copy, service status
  src/data/catalogApi.js  GET /rest/v1/titles → app title shape
  src/lib/supabase.js Supabase client (null when .env.local isn't set)
  src/state/          CatalogProvider (titles), AuthProvider (accounts, billing, preferences), AccessibilityProvider
                      (accessibility menu settings) and LibraryProvider (per-session data)
  src/pages/          One file per route; info/, games/ and account/ hold sub-pages
  src/components/     Layout (phone frame, tab bar, footer), PageHeader, Field, Player, Preview, AccessibilityPanel, hooks
  e2e/                Playwright specs + serve.js (static server used by the tests)
  .env.example        VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY; copy to .env.local (git-ignored)
supabase/             Supabase project czgzptjegmkvrxnxduxs ("eagle_platoon"); MCP config in supabase/.mcp.json
  migrations/         Schema + RLS, FK indexes (CONCURRENTLY: run one statement at a time), catalog titles, fixes
  seeds/              Development test data (6 example.com users, rows in every table); never run on production
schema.sql, drawsql.png  The original design; migrations/…_initial_schema.sql lists where it differs
.github/workflows/    CI: lint, build, Playwright on push/PR
```

The repo root also has a stray `package.json`/`package-lock.json`/`node_modules` from an early misplaced
install. They are intentionally **not committed**; don't add them.

## Commands (from `netflix_clone/`)

```bash
npm run dev            # http://localhost:5173
npm run lint
npm run build
npm run test:e2e       # builds, serves dist/ via e2e/serve.js on :4173, runs all specs at 390px and 1280px
npm run test:e2e:report
```

## Outline page → route map

| Outline page (§6) | Route | File |
| --- | --- | --- |
| Homepage | `/` | `pages/Home.jsx` (featured carousel, service banner, personalized row) |
| Movie / TV Show detail (incl. video player, captions) | `/title/:id` (`?play=1` opens the player) | `pages/TitleDetail.jsx`, `components/Player.jsx`, `data/clips.js`, `public/media/` |
| Search Results | `/search` | `pages/Search.jsx` (query, genre, type, release year, sort — all in the URL) |
| Watch list / Favorites | `/watchlist`, `/favorites` (`/my-netflix` = watch list) | `pages/MyNetflix.jsx` |
| Account Settings (incl. billing, autoplay, accessibility, delete account) | `/account` | `pages/Account.jsx`, `pages/account/Billing.jsx`, `pages/account/DeleteAccount.jsx` |
| Login / Signup / Logout | `/login`, `/signup`, `/logout` | `pages/Login.jsx`, `Signup.jsx`, `Logout.jsx` |
| Customer Support, FAQs, Feedback, Issue Reporting | `/info/support`, `/info/faqs`, `/info/feedback`, `/info/report-issue` | `pages/info/*` |
| Promotions/Discounts, Technical Requirements, AI Integration | `/info/promotions`, `/info/tech-requirements`, `/info/ai` | `pages/info/*` |
| Affiliate Program | `/info/affiliate` | `pages/info/Affiliate.jsx`, data in `data/affiliate.js` |
| Legal and Privacy, Terms, Privacy Policy, Do Not Sell | `/info/legal`, `/info/terms`, `/info/privacy`, `/info/do-not-sell` | `pages/info/LegalHub.jsx`, `Legal.jsx`, `DoNotSell.jsx` |
| Accessibility Policy | `/info/accessibility` | `pages/info/AccessibilityPolicy.jsx` |
| Accessibility menu (every page) | header icon, `<dialog>` | `components/AccessibilityPanel.jsx`, `state/AccessibilityProvider.jsx`, `state/accessibilityContext.js` |
| Error | any unknown route | `pages/NotFound.jsx` |
| (extra) Games, New & Hot | `/games`, `/games/:gameId`, `/new` | `pages/Games.jsx`, `pages/NewHot.jsx` |

When the outline changes: diff `app_outline/user_journey.md` (`git diff --word-diff`), map each change to this
table, add or extend the page, add `/info/<slug>` pages to `data/infoPages.js` (that also adds the footer link)
and `pages/InfoPage.jsx`, then add the route to the sweeps in `e2e/layout.spec.js` and `e2e/a11y.spec.js`.

## Conventions

- **All user state is in memory** — no localStorage (the Supabase client runs with `persistSession: false`). A full
  page load signs the user out and resets everything; this is a requirement, not a bug. `LibraryProvider` is keyed
  by the auth session. Accounts, watch list etc. have database tables but the app doesn't use them yet.
- **Catalog (Supabase)**: `CatalogProvider` renders the built-in `data/catalog.js` at once, then swaps in the
  `titles` rows from the REST API; on any error it keeps the built-in list. Read titles through `useCatalog()`
  (`titles`, `all`, `findTitle`, `genres`), never by importing `catalog` in a page. Sample reviews and watch progress
  still come from `catalog.js`. Adding a title: add it to `catalog.js`, regenerate `…_seed_titles.sql`, apply it.
- **Supabase security**: the project's default privileges grant anon/authenticated everything on new `public`
  tables, so every migration must `revoke all` and grant only what its RLS policies need, and enable RLS. Use the
  publishable key in the browser, never the secret/service_role key. Run `get_advisors` after schema changes.
- **Demo account**: "Use demo account" on `/login`. Its password is random per page load (`crypto.getRandomValues`)
  and shown on `/login` and in Account → Change password, so the demo user can change it or confirm deleting the
  account; never hardcode credentials. Billing is simulated: store only card brand, last four and expiry, never full numbers or CVC.
- **Forms**: use `components/Field.jsx`; validate on submit, then `focusFirstError(form)`; errors use `--error`
  (`#e87c03`), never the red accent.
- **Accessibility menu**: settings live in `AccessibilityProvider` (above the routes, so they work signed out and survive
  sign-in, but reset on reload). It mirrors them onto `<html>` as `data-a11y-*` attributes styled at the end of
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
- **Delete account**: needs `billing.status === 'cancelled'`, the typed email and the account password; it removes the account from memory
  only (data removal is a support ticket, `/info/report-issue?type=data-removal`). The sign-in notice comes from
  `notice` in `AuthProvider`, because signing out redirects before a navigation state could arrive.
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

- Every change should keep `npm run lint` and `npm run test:e2e` green; CI runs both.
- Tests sign in once with `signInAsDemo()` and move with `navigateInApp()` (client-side), because a reload logs out.
- `e2e/supabase.spec.js` checks the REST catalog; its live tests skip when `.env.local` isn't set (as in CI), and the
  offline-fallback test always runs.
- New features get a spec: `e2e/features.spec.js` (carousel, billing, affiliate…) and `e2e/accessibility.spec.js`
  (accessibility menu, policy, player and captions, autoplay, delete account).
- Header buttons are matched by exact name in tests (`'Accessibility menu', exact: true`), since "Close accessibility
  menu" also contains it.

## Environment gotchas

- **Console Ninja (VS Code extension) can hang `vite`**: it injects a hook into
  `node_modules/vite/bin/vite.js`. If `npm run dev` stalls after "Console Ninja extension is connected", restore
  the file with `npm install --force vite` and disable the extension for this workspace.
- The Playwright MCP browser is shared and sometimes zoomed; prefer `npx playwright test` for verification.
