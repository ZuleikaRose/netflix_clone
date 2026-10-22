import { useEffect, useMemo, useRef, useState } from 'react'
import { AccessibilityPanel } from '../components/AccessibilityPanel.jsx'
import { ShortcutsDialog } from '../components/ShortcutsDialog.jsx'
import { opensShortcutHelp } from '../data/shortcuts.js'
import { loadAccessibility, saveAccessibility } from '../data/accessibilityApi.js'
import { getSupabase } from '../lib/supabaseConfig.js'
import { AccessibilityContext, defaultA11y } from './accessibilityContext.js'
import { useAuth } from './authContext.js'

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

const warn = (error) => {
  if (import.meta.env.DEV) console.warn('Supabase:', error)
}

// Signed in with Supabase, the settings are saved per member: their saved settings apply when they sign in (or, the
// first time, what they picked while signed out is saved), and every change is saved. Otherwise they stay in memory.
function useSavedSettings(settings, setSettings) {
  const { backend, user } = useAuth()
  const userId = backend === 'supabase' ? user?.id : null
  // The settings known to be saved, and for whom; null userId until the sign-in load finishes
  const synced = useRef({ userId: null, json: null })
  const latest = useRef(settings)
  useEffect(() => { latest.current = settings }, [settings])

  useEffect(() => {
    synced.current = { userId: null, json: null }
    if (!userId) return
    let ignore = false
    getSupabase().then(async (supabase) => {
      const saved = await loadAccessibility(supabase, userId)
      if (ignore) return
      const current = saved ?? latest.current
      if (!saved) await saveAccessibility(supabase, userId, current)
      synced.current = { userId, json: JSON.stringify(current) }
      if (saved) setSettings(saved)
    }).catch(warn)
    return () => { ignore = true }
  }, [userId, setSettings])

  useEffect(() => {
    if (!userId || synced.current.userId !== userId) return
    const json = JSON.stringify(settings)
    if (json === synced.current.json) return
    synced.current.json = json
    getSupabase().then((supabase) => saveAccessibility(supabase, userId, settings)).catch(warn)
  }, [userId, settings])
}

export function AccessibilityProvider({ children }) {
  const [settings, setSettings] = useState(defaultA11y)
  const [menuOpen, setMenuOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  useEffect(() => applyToDocument(settings), [settings])
  // ? on any page (not while typing) opens the keyboard shortcuts help
  useEffect(() => {
    const onKeyDown = (e) => {
      if (!opensShortcutHelp(e)) return
      e.preventDefault()
      setMenuOpen(false)
      setShortcutsOpen(true)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
  useSavedSettings(settings, setSettings)

  const value = useMemo(() => ({
    settings,
    update: (patch) => setSettings((s) => ({ ...s, ...patch })),
    reset: () => setSettings(defaultA11y),
    menuOpen,
    openMenu: () => setMenuOpen(true),
    closeMenu: () => setMenuOpen(false),
    shortcutsOpen,
    openShortcuts: () => { setMenuOpen(false); setShortcutsOpen(true) },
    closeShortcuts: () => setShortcutsOpen(false),
  }), [settings, menuOpen, shortcutsOpen])

  return (
    <AccessibilityContext.Provider value={value}>
      {children}
      <AccessibilityPanel />
      <ShortcutsDialog />
      {settings.readingGuide && <ReadingGuide />}
    </AccessibilityContext.Provider>
  )
}
