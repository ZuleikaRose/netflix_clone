# Netflix Clone: user stories

[Netflix Clone on GitHub](https://github.com/ZuleikaRose/netflix_clone)

Pulled from `app_outline/` (the user journey and each page's `user_journey.md`) into one list: one line per thing the app has to *remember*. Story 1 isn't on any single page; it's there so the database knows who owns what.

These stories are what the Supabase database stores (see `schema.sql`, `drawsql.png` and `supabase/migrations/`). Without Supabase configured the app keeps the same data in memory, and it resets on refresh. Stories 26–32 were added with the Supabase backend. Stories 33–35 came with The Movie Database (TMDB): its titles are fetched live through the `tmdb` Edge Function and aren't stored, but each lookup is counted for rate limiting (story 31).

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
21. As a viewer, I want to watch real video with controls (play, pause, seek, skip 10 seconds, mute, speed, full screen) that work with a keyboard so that I can watch comfortably.
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
