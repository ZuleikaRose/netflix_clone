# Netflix Clone

A mobile-first, front-end-only streaming app built with React 19, Vite and React Router (`BrowserRouter`). It was built in phases from the wireframes, user journey and style guide in `../app_outline`.

There is no backend. **All data lives in memory**: refreshing the page signs you out and resets your list, ratings, reviews and settings.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run lint
npm run build
```

On the sign-in screen, choose **Use demo account**, or create an account with **Sign up**. The demo account's password is random on every page load; it's shown under the demo button and in Account → Change password.

### Demo data for trying features

| Feature | Try |
| --- | --- |
| Payment method (Account → Billing) | Test cards `4242 4242 4242 4242` (Visa) or `5555 5555 5555 4444` (Mastercard), any future expiry, any 3-digit code |
| Promo codes (Promotions & Discounts) | `WELCOME50`, `STUDENT20`, `FAMILY15` (Premium plan only) |
| Affiliate Program | Join with any `https://` URL, then use **Simulate a sign-up**: 11 sign-ups reaches the Pro tier |
| Referral sign-up | `/signup?ref=ALEX26` shows the "invited by a friend" welcome |
| Support chat | Ask about passwords, promo codes or devices; answers come from the FAQs |
| Maturity filter | Account → Maturity rating → Kids leaves only *Lantern Island* |
| Accessibility menu | The person icon at the top of any page (also on sign-in). Try the *Low vision* or *Dyslexia friendly* profile |
| Captions and player | Every title plays a real sample clip. Press **CC** (or the **C** key) for its English captions; drag the seek bar to the end of a *Night Shift* episode to see Autoplay next episode |
| Autoplay previews | Off by default: Home shows a **Preview** button. Turn on Account → Autoplay previews and previews start by themselves (never under reduced motion or *Stop animations*) |
| Delete account | Account → Danger zone. Cancel the membership in Billing first, then type `alex@example.com` and the password shown in Change password. The demo button recreates the demo account |

### Troubleshooting

If `npm run dev` stalls right after "Console Ninja extension is connected to Vite", the Console Ninja VS Code
extension has injected a hook into `node_modules/vite/bin/vite.js`. Run `npm install --force vite` to restore
the file, and disable the extension for this workspace to stop it coming back.

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
| `e2e/features.spec.js` | Carousel, service banner, personalization opt-out, crew, release-year filter, Watch list/Favorites routes, billing, affiliate program, referral sign-up, legal hub |
| `e2e/accessibility.spec.js` | Accessibility menu (signed out too, Escape, profiles, reset, no overflow at 150% text, reading guide), Accessibility Policy links, real clip playback and controls, captions from the clip's track (button, C key, menu, size), autoplay next episode on/off, autoplay previews vs. Stop animations and reduced motion, delete account (blocked until cancelled, email and password checks, data removal ticket) |
| `e2e/a11y.spec.js` | [axe-core](https://github.com/dequelabs/axe-core) WCAG 2.2 AA audit of every page and key interactive states (form errors, chat, expanded FAQ, answered trivia, billing errors and cancel confirmation, affiliate form and dashboard, accessibility menu, player with captions and end screen, delete account errors); keyboard focus never hidden behind the sticky bars (2.4.11) |

CI (`.github/workflows/ci.yml`) runs lint, build and the full suite on every push to `main` and on pull requests, and uploads the HTML report as an artifact.

Tests serve the production build with `e2e/serve.js`, a tiny static server with SPA fallback and byte-range support (needed to seek video), rather than `vite preview`. Because all state lives in memory, tests sign in once and then use client-side navigation (`navigateInApp()` in `e2e/helpers.js`), since a full page load signs the user out.

## What's inside

| Area | Routes | Highlights |
| --- | --- | --- |
| Auth | `/login`, `/signup`, `/logout` | Sign-in guard that returns you to the page you wanted; plan picker; accessible inline validation |
| Browse | `/`, `/title/:id`, `/search`, `/new` | Featured carousel with previews, maintenance banner, TV/Movie filters, Top 10, "Because You Liked…" recommendations, mock player with captions and full controls, ratings & reviews, share, URL-driven search filters |
| Library | `/my-netflix`, `/watchlist`, `/favorites`, `/account` | Watch list & Favorites pages; profile, password, plan, billing (payment method, billing date, pause, cancel), autoplay, maturity, accessibility and privacy settings, danger zone (delete account) |
| Games | `/games`, `/games/:gameId` | Poster Match (memory) and Plot Twist (trivia), with best scores for the session |
| Help & legal | `/info/:slug` | Support hub with live-chat mock, FAQs, Feedback, Issue Reporting, Promotions (working promo codes), Technical Requirements, AI Integration, Affiliate Program (join, referral dashboard, tiered commissions, marketing materials), Legal & Privacy hub, Terms, Privacy, Do Not Sell, Accessibility Policy |

The maturity setting in Account filters every catalog surface: Home, Search, New & Hot, related titles and games.

## Project layout

```
src/
  components/   Layout (phone frame + tab bar + footer), PageHeader, Field, PosterCard, ShareButton,
                useCopyToClipboard, useDocumentTitle, Player, Preview/usePreview,
                AccessibilityPanel, AccessibilityButton
  data/         Catalog, plans, billing, promotions, affiliate program, FAQs, legal copy, service status
                (all sample content)
  pages/        One file per route; account/, info/ and games/ hold the sub-pages
  state/        AuthProvider (accounts, billing, preferences, session), AccessibilityProvider (menu settings) and LibraryProvider
                (per-session list, ratings, reviews, reports, affiliate account, dismissed notices)
e2e/            Playwright specs, helpers and serve.js
```

Requirements and the outline-to-route map are in [`../CLAUDE.md`](../CLAUDE.md).

`LibraryProvider` is keyed by the auth session, so every sign-in starts with an empty library.

## Design notes

- Designed for 390px phones. On wider screens the app renders inside a centered phone frame with its own scroll area, so the tab bar stays pinned.
- One accent color (`#e50914`) for primary actions. Form errors use a distinct orange (`#e87c03`).
- Touch targets are at least 44px, keyboard focus is always visible, and every input has a label. Motion is subtle and turned off under `prefers-reduced-motion`.
- The accessibility menu's settings are applied as `data-a11y-*` attributes on `<html>` and reset on reload, like all other state. Its readable and dyslexia-friendly fonts are Atkinson Hyperlegible and Lexend from Google Fonts.

## Caveats

- Authentication, billing and the affiliate program are mocks for demonstration only. Passwords are held in plain JavaScript memory and only a card's brand, last 4 digits and expiry are kept; never reuse these patterns with real data.
- Sample clips (`public/media/`, about 17 MB) are excerpts of the Blender Foundation's open movies *Sintel* and *Tears of Steel* (CC BY 3.0) and *Elephants Dream* (CC BY 2.5), re-encoded to 360p. English captions come from Wikimedia Commons subtitles (CC BY-SA 4.0), re-timed to each excerpt and covering dialogue only. Credits appear under the player and in Legal & Privacy → Media credits.
- Deleting an account removes it from memory only.
- Titles, synopses, reviews and legal text are placeholder content. Posters reuse four Unsplash photos with CSS color filters.
