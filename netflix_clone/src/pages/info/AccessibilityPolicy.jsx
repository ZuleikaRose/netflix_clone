import { Link } from 'react-router-dom'
import { ShortcutKeys } from '../../components/ShortcutsDialog.jsx'
import { shortcutGroups } from '../../data/shortcuts.js'
import { locale } from '../../i18n/index.js'
import { useAccessibility } from '../../state/accessibilityContext.js'
import { useT } from '../../state/useT.js'

const features = [
  'An accessibility menu (the icon at the top of every page) with one-tap profiles and settings for text size, readable and dyslexia-friendly fonts, line height, letter spacing, contrast, color, link and heading highlights, a strong focus outline, a big cursor, a reading guide, hiding images and stopping animations.',
  'Closed captions in the video player, in three sizes, with a captions button on the player and a default in the accessibility menu.',
  'Audio description: the player reads out what happens on screen (in English or Spanish, following the caption language) and waits while it speaks, so descriptions never talk over the dialogue. Turn it on with the AD button, the D key or the accessibility menu.',
  'Player controls you can reach by keyboard: play or pause, skip back or forward 10 seconds, seek, mute, a volume slider (remembered for the next video, and on any device once you’re signed in), previous and next episode for TV shows, playback speed (0.75× to 1.5×), captions and full screen.',
  'Autoplay you control: previews never start by themselves unless you turn on Autoplay previews, and never when motion is reduced. Autoplay next episode can be turned off too.',
  'Every control works with a keyboard and has a visible focus outline. Buttons and links are at least 44 pixels tall.',
  'Labels on every form field, error messages linked to their fields, and focus moved to the first error.',
  'Motion is subtle and turns off when your device asks for reduced motion. Carousels never move by themselves.',
]

const playerShortcuts = shortcutGroups.find((g) => g.heading === 'Video player').keys
const UPDATED = new Date(2026, 9, 16)

export function AccessibilityPolicy() {
  const { openMenu, openShortcuts } = useAccessibility()
  const t = useT()
  const updated = UPDATED.toLocaleDateString(locale(), { dateStyle: 'long' })

  return (
    <article className="legal-doc">
      <p className="muted">{t('Last updated {date} · Sample policy for this demo app', { date: updated })}</p>

      <section aria-labelledby="commitment">
        <h2 id="commitment">{t('Our commitment')}</h2>
        <p>{t('Everyone should be able to find, watch and enjoy movies and TV shows here, including people who are blind or have low vision, are deaf or hard of hearing, or have motor, cognitive, learning or seizure-related disabilities.')}</p>
      </section>

      <section aria-labelledby="standard">
        <h2 id="standard">{t('Standard we follow')}</h2>
        <p>{t('We aim to meet the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA. Every page and key interaction is checked with automated accessibility tests on phone and desktop sizes before each release.')}</p>
      </section>

      <section aria-labelledby="features">
        <h2 id="features">{t('Accessibility features')}</h2>
        <ul className="check-list">{features.map((f) => <li key={f}>{t(f)}</li>)}</ul>
        <button type="button" className="cta" aria-haspopup="dialog" onClick={openMenu}>{t('Open accessibility menu')}</button>
      </section>

      <section aria-labelledby="shortcuts">
        <h2 id="shortcuts">{t('Video player keyboard shortcuts')}</h2>
        <p>{t('These work while focus is inside the player.')} {t('Press')} <kbd>?</kbd> {t('on any page to see every keyboard shortcut.')}</p>
        <dl className="shortcut-list">
          {playerShortcuts.map(([combo, action]) => (
            <div key={action}><dt><ShortcutKeys combo={combo} /></dt><dd>{t(action)}</dd></div>
          ))}
        </dl>
        <button type="button" className="ghost-cta" aria-haspopup="dialog" aria-keyshortcuts="?" onClick={openShortcuts}>{t('Show all keyboard shortcuts')}</button>
      </section>

      <section aria-labelledby="limits">
        <h2 id="limits">{t('Known limitations')}</h2>
        <p>{t('This is a demo: every title plays a short sample clip from an open movie, with that film’s English captions (and our Spanish translation). The captions cover dialogue only, without sound descriptions. Audio description uses your browser’s built-in voice, so it sounds different on each device. In a watch party the video doesn’t wait for descriptions, so everyone stays in step; they’re read over the video instead. When you’re signed in, your accessibility settings are saved to your account and come back on every device and after a refresh; when you’re signed out, they reset when the page reloads.')}</p>
      </section>

      <section aria-labelledby="contact">
        <h2 id="contact">{t('Feedback and help')}</h2>
        <p>
          {t('If something is hard to use, please')}{' '}
          <Link to="/info/report-issue?type=accessibility" className="inline-link">{t('report an accessibility issue')}</Link>{' '}
          {t('or')} <Link to="/info/support" className="inline-link">{t('contact Customer Support')}</Link>.{' '}
          {t('We aim to reply within 2 business days.')}
        </p>
      </section>
    </article>
  )
}
