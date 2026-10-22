# Netflix Clone: user stories

[Netflix Clone on GitHub](https://github.com/ZuleikaRose/netflix_clone)

Pulled from `app_outline/` (the user journey and each page's `user_journey.md`) into one list: one line per thing the app has to *remember*. Story 1 isn't on any single page; it's there so the database knows who owns what.

These stories are what the Supabase database stores (see `schema.sql`, `drawsql.png` and `supabase/migrations/`). Without Supabase configured the app keeps the same data in memory, and it resets on refresh. Stories 26–32 were added with the Supabase backend. Stories 33–35 came with The Movie Database (TMDB): its titles are fetched live through the `tmdb` Edge Function, and a TMDB title is stored only once a member saves it (story 36, `titles` with `source = 'tmdb'` plus `tmdb_titles`); lookups that reach TMDB are counted for rate limiting (story 31). Stories 36–38 were added with saved TMDB titles, player volume and episode buttons. Stories 39–44 came with Continue Watching (`watch_progress`), TMDB trailers, where to watch, reviews, recommendations and certifications (`tmdb_titles.trailer_youtube_key`, `tmdb_certifications`) and opt-in game leaderboards (`preferences.show_on_leaderboards`, `game_scores.updated_at`, the `game_leaderboard()` function). Stories 64–66 came with screen-time limits (`profiles.daily_limit_minutes`, `screen_time`), Spanish captions (`accessibility_settings.caption_language`) and reported reviews (`review_reports`); Surprise me, keyboard shortcuts help and offline downloads need no stored data (downloads stay in the browser). Stories 45–54 came with ten more features: profiles (`profiles`, and `profile_id` on the per-profile tables), the support dashboard (`staff`, `ticket_replies`), reminders and notifications (`reminders.release_date`, `profiles.notifications_seen_at`), viewing history and its privacy settings (`viewing_history`, `preferences.keep_viewing_history`, `preferences.history_retention_days`), custom lists (`custom_lists`, `custom_list_items`, `shared_list()`), watch parties (`watch_parties`, `watch_party_members`, `join_watch_party()`, private Realtime channels) and better search (`search_titles()`, `recent_searches`). Actor and director pages, episodes and the installable app need no stored data.

1. As a user, I want an account with my name, email and password so that my private lists and settings belong to me, and no one else can see or change them. Reviews and ratings are readable by everyone. (Supabase Auth keeps the password; private data shows a member only their own rows, while the catalog and reviews are publicly readable.)
2. As a user, I want to choose a membership plan (Basic, Standard or Premium) so that I know what I pay and what quality I get.
3. As a user, I want to save a payment method (only the card brand, last four digits and expiry) and a billing day so that I'm charged on a date that suits me.
4. As a user, I want to pause, cancel or restart my membership so that I only pay when I'm watching.
5. As a user, I want to browse movies and TV shows with a title, synopsis, genre, release year, maturity rating, cast and crew so that I can decide what to watch.
6. As a user, I want to add titles to my Watch list so that I can find them later.
7. As a user, I want to mark titles as Favorites (a title can be on both lists) so that I get recommendations based on what I love.
8. As a user, I want to rate a title and write a review so that other viewers know what I thought.
9. As a user, I want to set a reminder for an upcoming title so that I don't miss its release.
10. As a user, I want to set preferences (autoplay, email updates, personalized recommendations, maturity level) so that the app works the way I like.
11. As a user, I want to apply a promo code to my plan so that I get a discount.
12. As a user, I want to send feedback and report issues and get a ticket number so that I can follow up on a problem.
13. As a user, I want to opt out of the sale of my personal data so that my privacy choice is recorded.
14. As an affiliate, I want to join the Affiliate Program with my website and promotion channels so that I get my own referral code.
15. As an affiliate, I want each click and sign-up from my referral link counted so that I can see my tier and earnings.
16. As a user, I want my best score in each game saved so that I can try to beat it.
17. As a user, I want to see when each review, ticket and referral was created so that I know how recent it is.
18. As a user, I want to adjust text size, font, spacing, contrast and color, and turn on reading and navigation aids from an accessibility menu, so that the app works for how I see, read and move; as a member, I want these settings saved so that they come back when I sign in.
19. As a user, I want one-tap accessibility profiles (seizure safe, low vision, ADHD friendly, dyslexia friendly, keyboard navigation, deaf and hard of hearing) so that I can set up several settings at once.
20. As a user, I want to read an Accessibility Policy linked from the footer so that I know what the app supports and how to report a problem.
21. As a viewer, I want to watch real video with controls (play, pause, seek, skip 10 seconds, mute, volume, speed, previous and next episode, full screen) that work with a keyboard so that I can watch comfortably.
22. As a deaf or hard-of-hearing viewer, I want to turn closed captions on and choose their size so that I can follow along.
23. As a user, I want to turn autoplaying previews and next episodes on or off, and have them stay off when I ask for reduced motion, so that video doesn't start without my say.
24. As a user, I want to delete my account from a danger zone once my subscription is cancelled, by typing my email and entering my password to confirm, so that I can leave the service; deleting only removes my access.
25. As a user, I want to contact support with a data removal ticket so that my stored data can be erased if I choose.
26. As a user who forgot my password, I want to request a reset link by email and choose a new password so that I can get back into my account.
27. As a user, I want the app to require a strong password (13+ characters with lowercase, uppercase, a digit and a symbol) and refuse passwords found in data leaks so that my account is hard to break into.
28. As a visitor, I want to try the app with my own private demo account, without signing up, so that I can explore every feature; the demo account is deleted after 24 hours.
29. As a reviewer, I want my real account name shown on my reviews, and no one able to post under someone else's name, so that reviews can be trusted.
30. As a user, I want my promo code checked against the real offers and my plan so that only valid discounts are applied.
31. As the site owner, I want the public features (demo accounts, referral clicks, TMDB lookups) limited per visitor so that no one can flood the service or inflate an affiliate's counts.
32. As a member, I want to stay signed in when I refresh the page or come back later, until I choose Sign out, so that I don't have to sign in again every time.
33. As a user, I want to browse trending and popular movies and TV shows from TMDB on the home page so that I can discover real titles beyond the platform's catalog.
34. As a user, I want my searches to also find movies and TV shows on TMDB, with the same type, genre, year and sort filters, so that I can look up any title.
35. As a user, I want to open a TMDB title and see its poster, overview, rating, maturity rating, length, cast and crew, credited to TMDB, so that I can decide whether it's for me; as the site owner, I want the TMDB API key kept on the server so that no one can copy it from the browser.
36. As a member, I want to add a TMDB movie or TV show to My List or Favorites so that I can find it later next to the catalog's titles; the title's details come from TMDB, not from what my browser sends.
37. As a member, I want the video player to remember my volume on any device I sign in on so that I don't have to set it every time.
38. As a viewer of a TV show, I want previous and next episode buttons (and keyboard shortcuts) while I'm watching so that I can move between episodes without leaving the player.
39. As a member, I want the app to remember where I stopped in each title (and which episode) so that Continue Watching takes me back there on any device; finishing a movie takes it off the row and finishing an episode moves me on to the next.
40. As a user, I want to watch a TMDB title's trailer and see where I can stream, rent or buy it in the U.S. so that I can decide how to watch it; the trailer only loads from YouTube when I ask for it.
41. As a member, I want to rate and review TMDB titles like the catalog's titles so that I can share what I thought of them.
42. As a member, I want recommendations based on the TMDB titles I save (Because You Saved on Home, More Like This on the title) so that I discover similar titles; turning off personalized recommendations hides the Home row.
43. As a parent using a restricted profile, I want TMDB titles to carry their real U.S. maturity ratings so that my profile shows the ones within its setting and hides the rest (titles with no rating stay hidden).
44. As a member, I want to choose whether my first name and best scores appear on each game's leaderboard (off by default) so that I can compete without giving away more than I want.
45. As an account holder, I want up to five profiles, each with its own name, avatar and maturity rating (a Kids profile sees only kids' titles), so that everyone in my home gets their own lists, Continue Watching, history and game scores.
46. As a member, I want to read support's replies on my reports and answer them; as support staff, I want to see every member's tickets by status, reply and change a ticket's status, so that problems get solved in one conversation. Only staff can see other members' tickets.
47. As a member, I want to set a reminder for a TMDB film that isn't out yet (or a show's next episode), and a bell that counts what's new (released reminders, support replies) on every device for that profile, so that I don't miss a release or an answer.
48. As a member, I want to see each profile's viewing history day by day, hide entries or all of it, and download it, so that I know and control what's kept.
49. As a member, I want to pause my viewing history (nothing new is recorded, including searches) or have old history deleted after 90 days or a year, so that the app keeps only what I'm comfortable with.
50. As a member, I want my own named lists of titles, with a description, so that I can group titles my way.
51. As a member, I want to share a list by link that anyone can open without signing in, showing only the list's name, description, my profile name and its titles, and to stop sharing it at any time, so that friends can see my picks without seeing my account.
52. As a member, I want to start a watch party for a title and invite friends by link, so that play, pause and skipping happen for all of us, we see who's watching and can chat; only the party's members can join it, and it ends after six hours.
53. As a user, I want search to find titles even when I misspell them, so that a typo doesn't hide what I'm looking for.
54. As a member, I want my recent searches (the last ten, per profile) to come back in an empty search box until I clear them, so that I can repeat a search quickly.
55. As a member, I want to rate a title Not for me, I like this or Love this! in one tap, so that recommendations follow my taste and titles I don't want stop being suggested to my profile.
56. As a viewer of a TV show, I want Skip Recap and Skip Intro buttons, chapter marks on the progress bar and a picture of the frame I'm pointing at, so that I get to the part I want quickly; and picture-in-picture, so that I can keep watching while I browse.
57. As a member, I want a Year in Review for each profile (titles, episodes and hours watched, my longest streak, busiest month, top genres and the actor I saw most) that I can share, so that I can look back on what I watched.
58. As a parent, I want to lock my profile with a four-digit PIN (set with the account password), and Kids profiles to need the account password before account settings or profile management open, so that children stay in their own profile; five wrong PINs lock the profile for 15 minutes.
59. As a member, I want two-step sign-in with an authenticator app, so that my password alone isn't enough to get into my account; until the code is entered, none of my data can be read.
60. As a member, I want to see which devices are signed in to my account and sign out any of them, or all but this one, so that a lost phone or a shared computer can't keep using my account.
61. As a member who doesn't know what to watch, I want to describe what I'm in the mood for in my own words and get a few titles with a reason each, chosen only from titles my profile can watch, and to know what is sent to the AI service, so that I find something quickly without giving away who I am.
62. As a member, I want to make a one-time donation by card (from $1 to $10,000, from the coffee button on any page) and have each one recorded with its amount, date and whether it went through, so that I can support the app; my card number never reaches the app's database, only I can read my donations, and nobody (not even me) can change or delete them.
63. As a member, I want to see my past donations (amount, date and whether each went through) on the donation page, and to get Stripe's emailed receipt, so that I can keep track of what I gave.
64. As a parent, I want to set a daily viewing limit on a profile (from 30 minutes to 4 hours, with the account password) so that the player stops once the time is used up, and to allow 30 more minutes with the password when I choose; nobody watching can raise the limit or reset the time watched.
65. As a viewer, I want captions in Spanish as well as English, chosen in the accessibility menu and remembered with my other accessibility settings, so that I can follow along in the language I read best.
66. As a member, I want to report another member's review (spoilers, offensive, spam or something else, with optional details) so that support can look at it; as support staff, I want to see reported reviews with a copy of what was written and keep or remove each one, so that title pages stay useful and safe. A member can report a review once and never their own.

