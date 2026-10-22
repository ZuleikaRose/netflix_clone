import { useEffect, useId, useRef } from 'react'
import { Link } from 'react-router-dom'
import { a11yChoices, a11yProfiles, defaultA11y, a11ySwitches, profileIsOn, useAccessibility } from '../state/accessibilityContext.js'
import { useAuth } from '../state/authContext.js'
import { Icon } from './Icon.jsx'

function Choice({ name, value, onChange }) {
  const id = useId()
  const { label, options } = a11yChoices[name]
  return (
    <fieldset className="choice-group">
      <legend>{label}</legend>
      <div className="choice-options">
        {options.map(([optionValue, optionLabel, lang]) => (
          <label key={optionValue} className="choice">
            <input type="radio" name={`${id}-${name}`} checked={value === optionValue} onChange={() => onChange({ [name]: optionValue })} />
            <span lang={lang}>{optionLabel}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function Switch({ label, hint, checked, onChange }) {
  return (
    <label className="switch-row">
      <span><span className="switch-label">{label}</span><span className="muted">{hint}</span></span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}

// The accessibility menu: one-tap profiles plus individual text, color, navigation and media settings
export function AccessibilityPanel() {
  const { settings, update, reset, menuOpen, closeMenu, openShortcuts } = useAccessibility()
  const { user, setPreference } = useAuth()
  const dialogRef = useRef(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (menuOpen && !dialog.open) dialog.showModal()
    if (!menuOpen && dialog.open) dialog.close()
  }, [menuOpen])

  const toggleProfile = (profile) => {
    const turnOff = profileIsOn(settings, profile)
    // Turning a profile off restores only the settings it changed
    update(Object.fromEntries(Object.entries(profile.settings).map(([key, value]) => [key, turnOff ? defaultA11y[key] : value])))
  }

  const switches = (group) => a11ySwitches[group].map(({ key, label, hint }) => (
    <Switch key={key} label={label} hint={hint} checked={settings[key]} onChange={(on) => update({ [key]: on })} />
  ))

  return (
    <dialog ref={dialogRef} className="a11y-panel" aria-labelledby="a11y-title" onClose={closeMenu}>
      <header className="a11y-head">
        <h2 id="a11y-title">Accessibility</h2>
        <button type="button" className="icon-button" aria-label="Close accessibility menu" onClick={closeMenu}><Icon name="close" /></button>
      </header>

      <div className="a11y-body">
        <Choice name="language" value={settings.language} onChange={update} />

        <section aria-labelledby="a11y-profiles">
          <h3 id="a11y-profiles">Profiles</h3>
          <div className="profile-grid">
            {a11yProfiles.map((p) => (
              <button key={p.id} type="button" className="profile-btn" aria-pressed={profileIsOn(settings, p)} onClick={() => toggleProfile(p)}>
                <b>{p.label}</b><span>{p.hint}</span>
              </button>
            ))}
          </div>
        </section>

        <section aria-labelledby="a11y-text">
          <h3 id="a11y-text">Text</h3>
          {['textSize', 'font', 'lineHeight', 'letterSpacing'].map((name) => <Choice key={name} name={name} value={settings[name]} onChange={update} />)}
          {switches('text')}
        </section>

        <section aria-labelledby="a11y-color">
          <h3 id="a11y-color">Color</h3>
          <Choice name="contrast" value={settings.contrast} onChange={update} />
          <Choice name="saturation" value={settings.saturation} onChange={update} />
        </section>

        <section aria-labelledby="a11y-nav">
          <h3 id="a11y-nav">Navigation</h3>
          {switches('navigation')}
        </section>

        <section aria-labelledby="a11y-media">
          <h3 id="a11y-media">Video &amp; motion</h3>
          {switches('media')}
          <Choice name="captionSize" value={settings.captionSize} onChange={update} />
          <Choice name="captionLanguage" value={settings.captionLanguage} onChange={update} />
          {/* Autoplay belongs to the signed-in profile, so it's the same switch as in Account settings */}
          {user && (
            <>
              <Switch label="Autoplay previews" hint="Play previews on Home and title pages." checked={user.preferences.autoplayPreviews} onChange={(on) => setPreference('autoplayPreviews', on)} />
              <Switch label="Autoplay next episode" hint="Start the next episode when one ends." checked={user.preferences.autoplayNext} onChange={(on) => setPreference('autoplayNext', on)} />
            </>
          )}
        </section>
      </div>

      <footer className="a11y-foot">
        <button type="button" className="ghost-cta" onClick={reset}>Reset all settings</button>
        <button type="button" className="ghost-cta" aria-haspopup="dialog" aria-keyshortcuts="?" onClick={openShortcuts}>Keyboard shortcuts</button>
        <Link to="/info/accessibility" className="inline-link" onClick={closeMenu}>Accessibility Policy</Link>
      </footer>
    </dialog>
  )
}

