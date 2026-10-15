# Netflix Clone — project guide

Mobile-first, front-end-only streaming app (React 19 + Vite 8 + React Router 7 `BrowserRouter`).
Requirements live in `app_outline/`; the app lives in `netflix_clone/`.

## Layout

```
app_outline/          Requirements (source of truth for features)
  user_journey.md     Planning pipeline + 8-question template; §6 lists every required page
  pages/<Page>/       One folder per page; each holds a copy of user_journey.md
  style_guide.md      Visual rules (see "Design rules" below)
netflix_clone/        The Vite app — run all npm commands here
  src/data/           Catalog, plans, billing, promotions, affiliate program, FAQs, legal copy, service status
  src/state/          AuthProvider (accounts, billing, preferences) and LibraryProvider (per-session data)
  src/pages/          One file per route; info/, games/ and account/ hold sub-pages
  src/components/     Layout (phone frame, tab bar, footer), PageHeader, Field, hooks
  e2e/                Playwright specs + serve.js (static server used by the tests)
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
| Movie / TV Show detail | `/title/:id` | `pages/TitleDetail.jsx` |
| Search Results | `/search` | `pages/Search.jsx` (query, genre, type, release year, sort — all in the URL) |
| Watch list / Favorites | `/watchlist`, `/favorites` (`/my-netflix` = watch list) | `pages/MyNetflix.jsx` |
| Account Settings (incl. billing) | `/account` | `pages/Account.jsx`, `pages/account/Billing.jsx` |
| Login / Signup / Logout | `/login`, `/signup`, `/logout` | `pages/Login.jsx`, `Signup.jsx`, `Logout.jsx` |
| Customer Support, FAQs, Feedback, Issue Reporting | `/info/support`, `/info/faqs`, `/info/feedback`, `/info/report-issue` | `pages/info/*` |
| Promotions/Discounts, Technical Requirements, AI Integration | `/info/promotions`, `/info/tech-requirements`, `/info/ai` | `pages/info/*` |
| Affiliate Program | `/info/affiliate` | `pages/info/Affiliate.jsx`, data in `data/affiliate.js` |
| Legal and Privacy, Terms, Privacy Policy, Do Not Sell | `/info/legal`, `/info/terms`, `/info/privacy`, `/info/do-not-sell` | `pages/info/LegalHub.jsx`, `Legal.jsx`, `DoNotSell.jsx` |
| Error | any unknown route | `pages/NotFound.jsx` |
| (extra) Games, New & Hot | `/games`, `/games/:gameId`, `/new` | `pages/Games.jsx`, `pages/NewHot.jsx` |

When the outline changes: diff `app_outline/user_journey.md` (`git diff --word-diff`), map each change to this
table, add or extend the page, add `/info/<slug>` pages to `data/infoPages.js` (that also adds the footer link)
and `pages/InfoPage.jsx`, then add the route to the sweeps in `e2e/layout.spec.js` and `e2e/a11y.spec.js`.

## Conventions

- **All state is in memory** — no backend, no localStorage. A full page load signs the user out and resets
  everything; this is a requirement, not a bug. `LibraryProvider` is keyed by the auth session.
- **Demo account**: "Use demo account" on `/login`. Its password is random per page load (`crypto.getRandomValues`);
  never hardcode credentials. Billing is simulated: store only card brand, last four and expiry, never full numbers or CVC.
- **Forms**: use `components/Field.jsx`; validate on submit, then `focusFirstError(form)`; errors use `--error`
  (`#e87c03`), never the red accent.
- **Copy to clipboard**: use `useCopyToClipboard` — it handles a missing/blocked clipboard by showing the text.
- **Non-component exports** go in `.js` files, not next to components (React Fast Refresh lint rule).
- **Names**: hooks only for real hooks (`use*`); handlers are verbs (`applyCode`, `goToNextRound`).

## Design rules (from `app_outline/style_guide.md`)

- Designed for a 390px phone; on desktop the app sits in a centered phone frame that scrolls internally.
- One accent (`--accent: #e50914`) for primary actions; error orange is distinct.
- Touch targets ≥ 44px (use a `::before` hit area if the visual must be smaller); visible focus; labels on every input.
- Motion is subtle and disabled under `prefers-reduced-motion`; no auto-advancing carousels (WCAG 2.2.2).
- WCAG 2.2 AA is enforced by `e2e/a11y.spec.js` (axe-core) — keep it green.

## Testing

- Every change should keep `npm run lint` and `npm run test:e2e` green; CI runs both.
- Tests sign in once with `signInAsDemo()` and move with `navigateInApp()` (client-side), because a reload logs out.
- New features get a spec (see `e2e/features.spec.js` for the latest outline-driven additions).

## Environment gotchas

- **Console Ninja (VS Code extension) can hang `vite`**: it injects a hook into
  `node_modules/vite/bin/vite.js`. If `npm run dev` stalls after "Console Ninja extension is connected", restore
  the file with `npm install --force vite` and disable the extension for this workspace.
- The Playwright MCP browser is shared and sometimes zoomed; prefer `npx playwright test` for verification.
