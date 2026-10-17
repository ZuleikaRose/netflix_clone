import { Link } from 'react-router-dom'
import { useAccessibility } from '../../state/accessibilityContext.js'

const features = [
  'An accessibility menu (the icon at the top of every page) with one-tap profiles and settings for text size, readable and dyslexia-friendly fonts, line height, letter spacing, contrast, color, link and heading highlights, a strong focus outline, a big cursor, a reading guide, hiding images and stopping animations.',
  'Closed captions in the video player, in three sizes, with a captions button on the player and a default in the accessibility menu.',
  'Player controls you can reach by keyboard: play or pause, skip back or forward 10 seconds, seek, mute, playback speed (0.75× to 1.5×), captions and full screen.',
  'Autoplay you control: previews never start by themselves unless you turn on Autoplay previews, and never when motion is reduced. Autoplay next episode can be turned off too.',
  'Every control works with a keyboard and has a visible focus outline. Buttons and links are at least 44 pixels tall.',
  'Labels on every form field, error messages linked to their fields, and focus moved to the first error.',
  'Motion is subtle and turns off when your device asks for reduced motion. Carousels never move by themselves.',
]

const shortcuts = [['K', 'Play or pause'], ['J / L', 'Back or forward 10 seconds'], ['C', 'Captions on or off'], ['M', 'Mute or unmute'], ['F', 'Full screen']]

export function AccessibilityPolicy() {
  const { openMenu } = useAccessibility()

  return (
    <article className="legal-doc">
      <p className="muted">Last updated October 16, 2026 · Sample policy for this demo app</p>

      <section aria-labelledby="commitment">
        <h2 id="commitment">Our commitment</h2>
        <p>Everyone should be able to find, watch and enjoy movies and TV shows here, including people who are blind or have low vision, are deaf or hard of hearing, or have motor, cognitive, learning or seizure-related disabilities.</p>
      </section>

      <section aria-labelledby="standard">
        <h2 id="standard">Standard we follow</h2>
        <p>We aim to meet the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA. Every page and key interaction is checked with automated accessibility tests on phone and desktop sizes before each release.</p>
      </section>

      <section aria-labelledby="features">
        <h2 id="features">Accessibility features</h2>
        <ul className="check-list">{features.map((f) => <li key={f}>{f}</li>)}</ul>
        <button type="button" className="cta" aria-haspopup="dialog" onClick={openMenu}>Open accessibility menu</button>
      </section>

      <section aria-labelledby="shortcuts">
        <h2 id="shortcuts">Video player keyboard shortcuts</h2>
        <p>These work while focus is inside the player.</p>
        <dl className="shortcut-list">
          {shortcuts.map(([key, action]) => <div key={key}><dt><kbd>{key}</kbd></dt><dd>{action}</dd></div>)}
        </dl>
      </section>

      <section aria-labelledby="limits">
        <h2 id="limits">Known limitations</h2>
        <p>This is a demo: every title plays a short sample clip from an open movie, with that film’s English captions. The captions cover dialogue only, without sound descriptions. Audio description is not available yet. When you’re signed in, your accessibility settings are saved to your account and come back on every device and after a refresh; when you’re signed out, they reset when the page reloads.</p>
      </section>

      <section aria-labelledby="contact">
        <h2 id="contact">Feedback and help</h2>
        <p>If something is hard to use, please <Link to="/info/report-issue?type=accessibility" className="inline-link">report an accessibility issue</Link> or <Link to="/info/support" className="inline-link">contact Customer Support</Link>. We aim to reply within 2 business days.</p>
      </section>
    </article>
  )
}
