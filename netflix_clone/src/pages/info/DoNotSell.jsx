import { Link } from 'react-router-dom'
import { useAccessibility } from '../../state/accessibilityContext.js'
import { useLibrary } from '../../state/libraryContext.js'
import { useT } from '../../state/useT.js'

export function DoNotSell() {
  const { doNotSell, setDoNotSell } = useLibrary()
  const t = useT()
  // The policy statement stays in English (like the full legal documents); the controls are translated
  const english = useAccessibility().settings.language === 'en'

  return (
    <div className="settings">
      {!english && <p className="muted">{t('This document is available in English only.')}</p>}
      <section className="settings-card" aria-labelledby="dns-heading">
        <h2 id="dns-heading">{t('Your privacy choice')}</h2>
        <p className="muted" lang={english ? undefined : 'en'}>We don’t sell personal information. You can still opt out of sharing viewing data with partners for measurement and advertising.</p>
        <label className="switch-row">
          <span><span className="switch-label">{t('Opt out of data sharing')}</span><span className="muted">{t('Applies to this account for the rest of the session.')}</span></span>
          <input type="checkbox" role="switch" checked={doNotSell} onChange={(e) => setDoNotSell(e.target.checked)} />
        </label>
        <p className="save-status" role="status">{doNotSell && <><span aria-hidden="true">✓</span> {t('You’ve opted out. We won’t share your information.')}</>}</p>
      </section>
      <p className="muted">{t('Read the full')} <Link to="/info/privacy" className="inline-link">{t('Privacy Policy')}</Link>.</p>
    </div>
  )
}
