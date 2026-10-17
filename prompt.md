
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

> Later changed by the backend prompts below: the app now uses Supabase. Sessions still live only in the browser
> (a refresh signs you out), but members' data is saved in the database.

I have created a series of documents and images as a reference for what I would like this application to look like and isolated everything by pages. Take a look at this folder @./app_outline and read the `user_journey.md` file to get context for the users journey through the application. Then look at the `/home/zuleikarose/obsidian_wsl/netflix_clone/app_outline/netflix_mobile_wireframe` to visualize the entire application. Finally under pages, you'll find a wire-frame corresponding to each page along with a detailed user story for how a user would interact with this page. Additionally, when it comes to design style, you can read the `style_guide.md` and apply its guidelines as you see fit.

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

Still to do: custom SMTP for Auth emails, hosting, CAPTCHA on sign-up and sign-in, and rolling the latest
migrations and functions out to production.
