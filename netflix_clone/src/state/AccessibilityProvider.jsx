import { useEffect, useMemo, useState } from 'react'
import { AccessibilityPanel } from '../components/AccessibilityPanel.jsx'
import { AccessibilityContext, defaultA11y } from './accessibilityContext.js'

const kebab = (key) => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)

// Mirrors the settings onto <html> (data-a11y-* attributes, styled in index.css). Color changes use a filter on
// the root element, which unlike any other element doesn't break position: fixed/sticky descendants.
function applyToDocument(settings) {
  const root = document.documentElement
  for (const [key, value] of Object.entries(settings)) {
    const attr = `data-a11y-${kebab(key)}`
    if (value === defaultA11y[key]) root.removeAttribute(attr)
    else root.setAttribute(attr, String(value))
  }
  root.style.setProperty('--a11y-zoom', settings.textSize / 100)
  const filters = [
    settings.contrast === 'high' && 'contrast(1.35)',
    settings.saturation === 'low' && 'saturate(.4)',
    settings.saturation === 'mono' && 'grayscale(1)',
  ].filter(Boolean)
  root.style.filter = filters.join(' ')
}

function ReadingGuide() {
  const [y, setY] = useState(null)
  useEffect(() => {
    const follow = (e) => setY(e.clientY)
    window.addEventListener('pointermove', follow)
    return () => window.removeEventListener('pointermove', follow)
  }, [])
  return <div className="reading-guide" aria-hidden="true" style={{ top: y ?? '40%' }} />
}

export function AccessibilityProvider({ children }) {
  const [settings, setSettings] = useState(defaultA11y)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => applyToDocument(settings), [settings])

  const value = useMemo(() => ({
    settings,
    update: (patch) => setSettings((s) => ({ ...s, ...patch })),
    reset: () => setSettings(defaultA11y),
    menuOpen,
    openMenu: () => setMenuOpen(true),
    closeMenu: () => setMenuOpen(false),
  }), [settings, menuOpen])

  return (
    <AccessibilityContext.Provider value={value}>
      {children}
      <AccessibilityPanel />
      {settings.readingGuide && <ReadingGuide />}
    </AccessibilityContext.Provider>
  )
}
