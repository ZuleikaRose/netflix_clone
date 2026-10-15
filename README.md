# Netflix Clone

[![CI](https://github.com/ZuleikaRose/netflix_clone/actions/workflows/ci.yml/badge.svg)](https://github.com/ZuleikaRose/netflix_clone/actions/workflows/ci.yml)

A mobile-first, front-end-only video streaming app inspired by Netflix, built with **React 19**, **Vite 8** and
**React Router 7**. Every page and feature traces back to the planning documents in [`app_outline/`](app_outline/),
and every user journey is covered by Playwright end-to-end and WCAG 2.2 AA accessibility tests.

> There is no backend. All data lives in browser memory, so refreshing the page signs you out and resets everything.

## Quick start

```bash
cd netflix_clone
npm install
npm run dev          # http://localhost:5173 → choose "Use demo account"
npm run test:e2e     # full Playwright suite (first time: npx playwright install chromium)
```

## What you can do

- **Browse and watch:** featured carousel, Top 10, new releases, "Because You Liked…" recommendations, a mock player, and title pages with synopsis, cast, crew, ratings and reviews.
- **Find titles:** search by title, cast or genre; filter by genre, type and release year; sort by popularity, date or A–Z.
- **Save:** Watch list and Favorites pages, plus sharing links to titles.
- **Manage your account:** profile, password, plan, billing (payment method, billing date, pause, cancel), playback, maturity rating and privacy permissions.
- **Get help:** support hub with live chat, FAQs, feedback, issue reporting with ticket numbers, technical requirements and a maintenance banner.
- **Save money and earn:** promo codes that discount your plan, and an **Affiliate Program** with a referral dashboard, tiered commissions and marketing materials.
- **Read the legal pages:** Legal & Privacy hub, Terms of Service, Privacy Policy and a Do Not Sell opt-out.
- **Play:** two small games built from the catalog.

See [`netflix_clone/README.md`](netflix_clone/README.md) for the full route list, demo data and test details.

## Repository layout

| Path | What it is |
| --- | --- |
| [`netflix_clone/`](netflix_clone/) | The Vite app: source, Playwright tests, configs |
| [`app_outline/`](app_outline/) | Requirements: [`user_journey.md`](app_outline/user_journey.md), per-page folders, [`style_guide.md`](app_outline/style_guide.md), Figma wireframe export |
| [`.github/workflows/ci.yml`](.github/workflows/ci.yml) | CI: lint, build, end-to-end and accessibility tests on every push and pull request |
| [`CLAUDE.md`](CLAUDE.md) | Project guide: outline-to-route map, conventions, and how to apply outline changes |
| `page_1_planning_pipeline.png`, `page_2_8_question_practical_template.png`, `prompt.md` | Original planning material and the build prompt |

## Quality checks

- **72 Playwright tests:** every journey runs at phone (390×844) and desktop (1280×800) sizes.
- **Accessibility:** an axe-core WCAG 2.2 AA audit of every page and key interactive state, plus checks for 44px touch targets, visible keyboard focus, and focus never hidden behind the sticky bars.
- **CI** runs lint, build and the full suite on GitHub Actions.

## Notes

- Sign-in, billing and the affiliate program are simulated for demonstration. Passwords live only in memory, and only a card's brand, last 4 digits and expiry are kept. Don't reuse these patterns with real data.
- Titles, reviews, people and legal text are placeholder content.
