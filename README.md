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

- **Browse and watch:** featured carousel with previews, Top 10, new releases, "Because You Liked…" recommendations, and title pages with synopsis, cast, crew, ratings and reviews. Every title plays a real sample clip from a Blender open movie, with real English captions, in a player with play/pause, seek, skip 10 seconds, mute, speed, full screen, closed captions, keyboard shortcuts and autoplay of the next episode.
- **Find titles:** search by title, cast or genre; filter by genre, type and release year; sort by popularity, date or A–Z.
- **Save:** Watch list and Favorites pages, plus sharing links to titles.
- **Manage your account:** profile, password, plan, billing (payment method, billing date, pause, cancel), autoplay previews and next episode, maturity rating, privacy permissions, and a danger zone to delete your account.
- **Make it work for you:** an accessibility menu on every page with one-tap profiles and settings for text size, readable and dyslexia-friendly fonts, spacing, contrast, color, link and heading highlights, focus outline, big cursor, reading guide, hiding images, stopping animations and captions.
- **Get help:** support hub with live chat, FAQs, feedback, issue reporting with ticket numbers, technical requirements and a maintenance banner.
- **Save money and earn:** promo codes that discount your plan, and an **Affiliate Program** with a referral dashboard, tiered commissions and marketing materials.
- **Read the legal pages:** Legal & Privacy hub, Terms of Service, Privacy Policy, Accessibility Policy and a Do Not Sell opt-out.
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

- **100 Playwright tests:** every journey runs at phone (390×844) and desktop (1280×800) sizes.
- **Accessibility:** an axe-core WCAG 2.2 AA audit of every page and key interactive state (including the accessibility menu, the player with captions and the delete-account form), plus checks for 44px touch targets, visible keyboard focus, and focus never hidden behind the sticky bars.
- **CI** runs lint, build and the full suite on GitHub Actions.

## Notes

- Sign-in, billing and the affiliate program are simulated for demonstration. Passwords live only in memory, and only a card's brand, last 4 digits and expiry are kept. Don't reuse these patterns with real data.
- Titles, reviews, people and legal text are placeholder content.
- Sample video clips are short excerpts of *Sintel*, *Tears of Steel* and *Elephants Dream* by the Blender Foundation (CC BY 3.0 / 2.5), with English captions from Wikimedia Commons (CC BY-SA 4.0). Credits are shown in the player and in the app's Legal & Privacy page.
