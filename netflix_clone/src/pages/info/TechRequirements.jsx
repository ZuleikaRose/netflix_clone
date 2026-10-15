import { useState } from 'react'

const speeds = [
  { quality: 'SD (480p)', mbps: 1 },
  { quality: 'HD (720p)', mbps: 3 },
  { quality: 'Full HD (1080p)', mbps: 5 },
  { quality: '4K Ultra HD', mbps: 15 },
]

const devices = [
  ['Phones & tablets', 'iOS 16+ or Android 10+, in Safari, Chrome or the app'],
  ['Computers', 'Latest two versions of Chrome, Edge, Firefox or Safari'],
  ['TVs & streaming sticks', 'Smart TVs from 2019 or newer'],
]

function checkDevice() {
  // navigator.connection is Chromium-only; report "unknown" elsewhere rather than guessing
  const downlink = navigator.connection?.downlink
  return [
    ['Browser online', navigator.onLine ? 'Yes' : 'No', navigator.onLine],
    ['Screen', `${window.screen.width}×${window.screen.height}`, true],
    ['Estimated speed', downlink ? `${downlink} Mbps` : 'Unknown in this browser', downlink ? downlink >= 3 : null],
    ['Video playback', document.createElement('video').canPlayType('video/mp4') ? 'Supported' : 'Not supported', Boolean(document.createElement('video').canPlayType('video/mp4'))],
  ]
}

export function TechRequirements() {
  const [results, setResults] = useState(null)

  return (
    <div className="settings">
      <section className="settings-card" aria-labelledby="speed-heading">
        <h2 id="speed-heading">Recommended internet speeds</h2>
        <table className="spec-table">
          <thead><tr><th scope="col">Quality</th><th scope="col">Minimum</th></tr></thead>
          <tbody>{speeds.map((s) => <tr key={s.quality}><th scope="row">{s.quality}</th><td>{s.mbps} Mbps</td></tr>)}</tbody>
        </table>
      </section>

      <section className="settings-card" aria-labelledby="device-heading">
        <h2 id="device-heading">Supported devices</h2>
        <dl className="spec-list">{devices.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      </section>

      <section className="settings-card" aria-labelledby="check-heading">
        <h2 id="check-heading">Check this device</h2>
        <button type="button" className="cta" onClick={() => setResults(checkDevice())}>{results ? 'Check again' : 'Run check'}</button>
        {results && (
          <ul className="check-results" aria-live="polite">
            {results.map(([label, value, ok]) => (
              <li key={label}>
                <span className={ok === null ? 'pill' : ok ? 'pill ok' : 'pill bad'} aria-hidden="true">{ok === null ? '?' : ok ? '✓' : '!'}</span>
                <span>{label}</span><b>{value}</b>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
