import { Link } from 'react-router-dom'
import { useLibrary } from '../../state/libraryContext.js'

export function DoNotSell() {
  const { doNotSell, setDoNotSell } = useLibrary()

  return (
    <div className="settings">
      <section className="settings-card" aria-labelledby="dns-heading">
        <h2 id="dns-heading">Your privacy choice</h2>
        <p className="muted">We don’t sell personal information. You can still opt out of sharing viewing data with partners for measurement and advertising.</p>
        <label className="switch-row">
          <span><span className="switch-label">Opt out of data sharing</span><span className="muted">Applies to this account for the rest of the session.</span></span>
          <input type="checkbox" role="switch" checked={doNotSell} onChange={(e) => setDoNotSell(e.target.checked)} />
        </label>
        <p className="save-status" role="status">{doNotSell && <><span aria-hidden="true">✓</span> You’ve opted out. We won’t share your information.</>}</p>
      </section>
      <p className="muted">Read the full <Link to="/info/privacy" className="inline-link">Privacy Policy</Link>.</p>
    </div>
  )
}
