# Netflix Clone

A mobile-first, front-end-only streaming app built with React 19, Vite and React Router (`BrowserRouter`). It was built in phases from the wireframes, user journey and style guide in `../app_outline`.

There is no backend. **All data lives in memory**: refreshing the page signs you out and resets your list, ratings, reviews and settings.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run lint
npm run build && npm run preview
```

On the sign-in screen, choose **Use demo account**, or create an account with **Sign up**.

## Testing

End-to-end tests use [Playwright](https://playwright.dev) and run every journey at phone (390×844) and desktop (1280×800) sizes:

```bash
npx playwright install chromium   # first time only
npm run test:e2e                  # builds the app, serves dist/, runs the suite
npm run test:e2e:report           # open the HTML report from the last run
```

| Spec | Covers |
| --- | --- |
| `e2e/auth.spec.js` | Sign-in guard and return path, validation, sign-up (incl. duplicate email), sign-out, refresh reset |
| `e2e/browse.spec.js` | Home rows and filters, title actions (list, favorite, rate, review, play), recommendations, search URL state, maturity filtering, 404 |
| `e2e/help.spec.js` | Every footer link, support chat, FAQ search, feedback and issue forms, promo codes, share fallback |
| `e2e/games.spec.js` | A full Poster Match playthrough, all five Plot Twist rounds |
| `e2e/layout.spec.js` | Every route: heading present, no horizontal overflow, 44px touch targets, no console errors; keyboard focus order |

Tests serve the production build with `e2e/serve.js`, a tiny static server with SPA fallback, rather than `vite preview`. Because all state lives in memory, tests sign in once and then use client-side navigation (`navigateInApp()` in `e2e/helpers.js`), since a full page load signs the user out.

## What's inside

| Area | Routes | Highlights |
| --- | --- | --- |
| Auth | `/login`, `/signup`, `/logout` | Sign-in guard that returns you to the page you wanted; plan picker; accessible inline validation |
| Browse | `/`, `/title/:id`, `/search`, `/new` | TV/Movie filters, Top 10, "Because You Liked…" recommendations, mock player, ratings & reviews, share, URL-driven search filters |
| Library | `/my-netflix`, `/account` | My List & Favorites; profile, password, plan, playback and maturity settings |
| Games | `/games`, `/games/:gameId` | Poster Match (memory) and Plot Twist (trivia), with best scores for the session |
| Help & legal | `/info/:slug` | Support hub with live-chat mock, FAQs, Feedback, Issue Reporting, Promotions (working promo codes), Technical Requirements, AI Integration, Terms, Privacy, Do Not Sell |

The maturity setting in Account filters every catalog surface: Home, Search, New & Hot, related titles and games.

## Project layout

```
src/
  components/   Layout (phone frame + tab bar + footer), PageHeader, Field, PosterCard, ShareButton…
  data/         Catalog, plans, promotions, FAQs, legal copy (all sample content)
  pages/        One file per route; info/ and games/ hold the sub-pages
  state/        AuthProvider (accounts, session) and LibraryProvider (per-session list, ratings, reports…)
```

`LibraryProvider` is keyed by the auth session, so every sign-in starts with an empty library.

## Design notes

- Designed for 390px phones. On wider screens the app renders inside a centered phone frame with its own scroll area, so the tab bar stays pinned.
- One accent color (`#e50914`) for primary actions. Form errors use a distinct orange (`#e87c03`).
- Touch targets are at least 44px, keyboard focus is always visible, and every input has a label. Motion is subtle and turned off under `prefers-reduced-motion`.

## Caveats

- Authentication is a mock for demonstration only. Passwords are held in plain JavaScript memory; never reuse this pattern with real credentials.
- Titles, synopses, reviews and legal text are placeholder content. Posters reuse four Unsplash photos with CSS color filters.
