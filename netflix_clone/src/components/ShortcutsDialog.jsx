import { Fragment, useEffect, useRef } from 'react'
import { shortcutGroups } from '../data/shortcuts.js'
import { useAccessibility } from '../state/accessibilityContext.js'
import { useT } from '../state/useT.js'
import { Icon } from './Icon.jsx'

// A shortcut's keys: ['Shift', '+', 'P'] → Shift + P, with 'or' and '+' as words
export function ShortcutKeys({ combo }) {
  const t = useT()
  return combo.map((k) => (k === 'or' || k === '+' ? <Fragment key={k}> {k === 'or' ? t('or') : k} </Fragment> : <kbd key={k}>{k}</kbd>))
}

// Keyboard shortcuts help: opened with ? on any page (AccessibilityProvider listens) or from the accessibility menu
export function ShortcutsDialog() {
  const { shortcutsOpen, closeShortcuts } = useAccessibility()
  const t = useT()
  const dialogRef = useRef(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (shortcutsOpen && !dialog.open) dialog.showModal()
    if (!shortcutsOpen && dialog.open) dialog.close()
  }, [shortcutsOpen])

  return (
    <dialog ref={dialogRef} className="a11y-panel shortcuts-dialog" aria-labelledby="shortcuts-title" onClose={closeShortcuts}>
      <header className="a11y-head">
        <h2 id="shortcuts-title">{t('Keyboard shortcuts')}</h2>
        <button type="button" className="icon-button" aria-label={t('Close keyboard shortcuts')} onClick={closeShortcuts}><Icon name="close" /></button>
      </header>
      {/* Only text inside, so the list itself takes focus: keyboard users can scroll it (axe: scrollable-region-focusable) */}
      <div className="a11y-body" tabIndex={0} role="region" aria-label={t('Shortcut list')}>
        {shortcutGroups.map(({ heading, note, keys }) => (
          <section key={heading} aria-labelledby={`shortcuts-${heading}`}>
            <h3 id={`shortcuts-${heading}`}>{t(heading)}</h3>
            {note && <p className="muted">{t(note)}</p>}
            <dl className="shortcut-list">
              {keys.map(([combo, action]) => (
                <div key={action}>
                  <dt><ShortcutKeys combo={combo} /></dt>
                  <dd>{t(action)}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </dialog>
  )
}
