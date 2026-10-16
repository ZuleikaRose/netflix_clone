# Style Guide — Liftlog

**Vibe:** a well-used gym notebook meets a scoreboard. Confident, high-contrast, fast. Not a generic SaaS dashboard.

* **Mobile-first:** design for a 390px-wide phone; it should still look intentional on desktop (centered column, max ~480px, or a two-column layout on wide screens).
* **Colors:** chalk black background, white text, ONE energetic accent (e.g. plate-red) used only for primary actions and PRs. Error red must be distinct from the accent.
* **Type:** a condensed, smiley display face for headings and numbers; a highly readable sans for body.
* **Touch targets:** at least 44px tall. Primary button ("Start Watching", "Choose a Genre") full-width.
* **Motion:** subtle and quick. A set row slides in when added; the PR trophy gets one small celebration. Respect reduced-motion. Video never autoplays unless the user turns autoplay on, and never under reduced motion or "Stop animations"; anything that moves has a pause control.
* **Navigation:** bottom tab bar on mobile (Home · Log · History), highlights the current page.
* **Accessibility:** visible keyboard focus, labels on every input, contrast AA or better. Target WCAG 2.2 AA. An accessibility menu (icon in every page header) lets users change text size, font (readable or dyslexia-friendly), spacing, contrast, color, link and heading highlights, focus outline, cursor size, reading guide, images, animations, captions and autoplay. The video player has keyboard-accessible controls and closed captions. Destructive actions (such as Delete account) use a separate red danger style, distinct from both the accent and the error color.
