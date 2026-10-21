import { useEffect, useState, useSyncExternalStore } from 'react'
import { pwaState, runningInstalled, subscribePwa } from '../lib/pwa.js'

// { canInstall, installed, updateWaiting } from the service worker and the browser's install prompt
export function usePwa() {
  const snapshot = useSyncExternalStore(subscribePwa, () => {
    const s = pwaState()
    return `${Boolean(s.installPrompt)}|${s.installed}|${Boolean(s.updateWaiting)}`
  })
  const [canInstall, installed, updateWaiting] = snapshot.split('|').map((v) => v === 'true')
  return { canInstall, installed: installed || runningInstalled(), updateWaiting }
}

// false while the browser reports no connection
export function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])
  return online
}
