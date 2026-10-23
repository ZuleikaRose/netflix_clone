import { useState } from 'react'
import { useT } from '../../state/useT.js'

const speeds = [
  { quality: 'SD (480p)', mbps: 1 },
  { quality: 'HD (720p)', mbps: 3 },
  { quality: 'Full HD (1080p)', mbps: 5 },
  { quality: '4K Ultra HD', mbps: 15 },
]

const devices = [
  ['Phones & tablets', 'iOS 16+ or Android 10+, in Safari or Chrome; install it from Account → App to use it like an app'],
  ['Computers', 'Latest two versions of Chrome, Edge, Firefox or Safari'],
  ['TVs & streaming sticks', 'Smart TVs from 2019 or newer'],
]

// English labels and values, shown in the interface language
function checkDevice() {
  // navigator.connection is Chromium-only; report "unknown" elsewhere rather than guessing
  const downlink = navigator.connection?.downlink
  return [
    ['Browser online', navigator.onLine ? 'Yes' : 'No', navigator.onLine],
    ['Screen', `${window.screen.width}×${window.screen.height}`, true],
    ['Estimated speed', downlink ? `${downlink} Mbps` : 'Unknown in this browser', downlink ? downlink >= 3 : null],
    ['Video playback', document.createElement('video').canPlayType('video/mp4') ? 'Supported' : 'Not supported', Boolean(document.createElement('video').canPlayType('video/mp4'))],
    // Installing and opening offline need a service worker
    ['Install as an app', 'serviceWorker' in navigator ? 'Supported' : 'Not supported', 'serviceWorker' in navigator],
  ]
}

export function TechRequirements() {
  const t = useT()
  const [results, setResults] = useState(null)

  return (
    <div className="settings">
      <section className="settings-card" aria-labelledby="speed-heading">
        <h2 id="speed-heading">{t('Recommended internet speeds')}</h2>
        <table className="spec-table">
          <thead><tr><th scope="col">{t('Quality')}</th><th scope="col">{t('Minimum')}</th></tr></thead>
          <tbody>{speeds.map((s) => <tr key={s.quality}><th scope="row">{t(s.quality)}</th><td>{s.mbps} Mbps</td></tr>)}</tbody>
        </table>
      </section>

      <section className="settings-card" aria-labelledby="device-heading">
        <h2 id="device-heading">{t('Supported devices')}</h2>
        <dl className="spec-list">{devices.map(([k, v]) => <div key={k}><dt>{t(k)}</dt><dd>{t(v)}</dd></div>)}</dl>
      </section>

      <section className="settings-card" aria-labelledby="check-heading">
        <h2 id="check-heading">{t('Check this device')}</h2>
        <button type="button" className="cta" onClick={() => setResults(checkDevice())}>{results ? t('Check again') : t('Run check')}</button>
        {results && (
          <ul className="check-results" aria-live="polite">
            {results.map(([label, value, ok]) => (
              <li key={label}>
                <span className={ok === null ? 'pill' : ok ? 'pill ok' : 'pill bad'} aria-hidden="true">{ok === null ? '?' : ok ? '✓' : '!'}</span>
                <span>{t(label)}</span><b>{t(value)}</b>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
