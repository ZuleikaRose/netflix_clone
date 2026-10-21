
# The build prompt (paste into Claude Code from the project root)

I would like you to build a Front-End Single Page Application from the wire frames and user stories I have mapped out.

The tech-stack for this application will be as follows:

* React.js + Vite
* React Router DOM with Browser Router

Skills necessary for this application are as follows:

* Front-End Design
* UI UX Pro Max
* Taste
* Design Motion Principles

There will be no API interactions and all data should be retained only at the browser level, meaning if I refresh/rerender my site all of the data should reset.

> Later changed by the backend prompts below: the app now uses Supabase. Members' data is saved in the database, and
> since prompt 10 a refresh keeps them signed in.

I have created a series of documents and images as a reference for what I would like this application to look like and isolated everything by pages. Take a look at this folder @./app_outline and read the `user_journey.md` file to get context for the users journey through the application. Then look at the `/home/zuleikarose/obsidian_wsl/netflix_clone/app_outline/my_app_mobile_wireframe` to visualize the entire application. Finally under pages, you'll find a wire-frame corresponding to each page along with a detailed user story for how a user would interact with this page. Additionally, when it comes to design style, you can read the `style_guide.md` and apply its guidelines as you see fit.

Take a look at the @../user_stories.md. Gather all details.

Use the Context7 MCP to gather all relevant documentation for our tech stack.

Ensure to utilize the `playwright` & `Chrome Dev Tools` MCP servers to supervise the development of this Application. After each page is built, use Playwright to screenshot it and compare against the wireframe before moving on and ensuring it's output matches the desired outcome from the wire-frames and user stories.

Finally the execution of this app should happen in phases, phases should correspond roughly to pages or major feature areas. I'll leave it to you to declare the number of phases and what their independent passing conditions are, but these conditions should be approved by me and allow me to provide you feedback before moving on into the next phase.

Before writing any code, please confirm your understanding of the application by summarizing the user journey and listing the pages you plan to build.

The app must also meet WCAG 2.2 AA and include: an Accessibility Policy page linked in the footer; an accessibility menu on every page (like the OneTap accessibility app) with one-tap profiles and settings for text size, fonts, spacing, contrast, color, highlighted links and headings, focus outline, cursor, reading guide, hiding images and stopping animations; a video player that plays short open-licensed clips (such as the Creative Commons Blender films) with real caption files, with player controls and a closed captions toggle; user control over autoplaying video (Autoplay previews and Autoplay next episode must actually work); and a red Delete Account button in a danger zone in account settings that requires a cancelled subscription, the user's typed email and their password, explains that it only removes access, and points to a support ticket for data removal.

---

## Shorter variant if you're short on class time

Same as above, but add at the end:

> Keep it to 2 phases for this demo: Phase 1 = app shell + routing + Home page. Phase 2 = Log Workout, History, and Workout Detail.
>

---

## Backend prompts (Supabase phase)

These came after the front end was built, in this order. Skills used: PostgreSQL Table Design
(`supabase/.claude/skills/`), plus the Supabase MCP server and CLI.

1. Connect to Supabase project `czgzptjegmkvrxnxduxs` via MCP and create tables based on `drawsql.png` and
   `schema.sql`. Connect the REST API to the front end of the Netflix Clone app. Test, summarize what's been done
   and recommend what to do next.
2. Give the app test data so it populates the database. List any errors and recommendations how to fix them, and ask
   any questions.
3. Commit and push to GitHub. Do recommendations 1–7. Move sign-in to Supabase Auth (a private demo account per
   visitor; a reload still signs out; a second free project for development; email confirmation off). Make sure
   indexing is set up.
4. Turn on leaked password protection for all projects (needs the Pro plan).
5. Open a pull request from `supabase-backend` to `main`; test, check for errors, show recommendations and ask
   questions; commit and push.
6. Do every recommendation except custom SMTP (saved for later). Make the password rules the same strict rules as the
   dev project. Build a Forgot Password feature and page. Save hosting for later and merge PR #1. Commit and push.
7. Merge PR #2.
8. Update `user_stories.md`, `user_journey.md`, the READMEs, `CLAUDE.md`, `prompt.md`, `schema.sql` and `drawsql.png`
   to match all the changes.
9. Update the SKILL.md file; show the stray root files; make sure Supabase has indexing turned on on all projects
   (Index Advisor installed; every foreign key and query index on both); merge PR #3.
10. In the README, remove "There is no backend…" and describe the Supabase backend and the REST API. Change the app so a
    refresh doesn't sign you out.

11. Connect to the `eagle_platoon_dev` Supabase project. Create an Edge Function with no authentication and a CORS
    header that returns a JSON message saying Supabase is up and running (`hello`), then change it to "Hello World".
12. Create an Edge Function that takes two numbers (6, 6) and returns `{"result":36}` (`multiply`).
13. Use TMDB (The Movie Database) through an Edge Function named `tmdb`, with the key saved as `TMDB_API_FREE` in
    Supabase, and add its information to the app: trending and popular rows, TMDB data on existing titles, and TMDB
    search, for movies and TV shows. Keep it in TypeScript/JavaScript, not Python. (TMDB data on the catalog's own
    titles was dropped: they're fictional, so matches were unrelated real titles.)
14. Commit and push; deploy the functions to `eagle_platoon` (production), where `TMDB_API_FREE` is also set.
15. Update the production database (the auth support and rate limit migrations, at the same versions as dev).
16. Update `drawsql.png`, `schema.sql`, the READMEs, `user_journey.md`, `user_stories.md`, `prompt.md`, `CLAUDE.md`,
    the style guide and both Supabase databases to match the changes. Commit and push.

17. Let users see more titles left and right in each row; rename "New on Netflix" to New on TMDB; make TMDB titles
    show in Search and follow the Type, Released and Sort by filters. Open a pull request, merge it once CI passes,
    deploy the updated function to production, commit and push.
18. Add four more games besides Poster Match and Plot Twist (Timeline, Cast Call, Higher or Lower, Title Scramble).
19. Make "Top 10 in the U.S. Today" have 10 entries, filled with TMDB titles.
20. Add volume controls to the video player.
21. Add a new table and columns (saving TMDB titles to lists, the player volume per member) and previous/next
    episode buttons in the player; update `drawsql.png`, `schema.sql`, `user_journey.md`, `user_stories.md`, the
    style guide, `CLAUDE.md`, `prompt.md`, both Supabase projects and the README, committing and pushing after each.
22. Make sure `drawsql.png`, `schema.sql`, the READMEs, `user_journey.md`, `user_stories.md`, `prompt.md`, `CLAUDE.md`,
    the style guide and both Supabase databases are up to date with the changes; commit and push. (Both projects
    already ran the same 7 migrations and 7 functions; only this file needed the new entry.)

23. Recommended next features, all built: Continue Watching saved per member, TMDB trailers, member reviews of TMDB
    titles, Because You Saved recommendations, where to watch, real certifications for TMDB titles so restricted
    profiles see them, and opt-in game leaderboards. Merge pull request #11 first. Test, commit and push; update
    `drawsql.png` and `schema.sql` (new tables `watch_progress` and `tmdb_certifications`, new columns); update
    `user_journey.md`, `user_stories.md`, the style guide, `CLAUDE.md` and `prompt.md`; apply the changes to both
    Supabase projects; update the README, committing and pushing after each step.

24. Make "Top 10 in the U.S. Today" TMDB's top ten movies and TV shows, and the Home carousel TMDB's movies and TV
    shows. Open a pull request and merge it once CI passes.
25. "Please recommend 10 more features", then "please do 1 through 10. After each feature, test and fix, commit and
    push to github": profiles (including Kids), a support dashboard, actor and director pages, seasons and episodes,
    reminders for TMDB releases with a notifications bell, viewing history and privacy controls, shareable custom
    lists, watch parties over Realtime, better search (pg_trgm, recent searches, suggestions) and an installable PWA.
    Migrations were applied to the dev project as each feature was built; production is updated after review.

Still to do: custom SMTP for Auth emails, hosting and CAPTCHA on sign-up and sign-in.
