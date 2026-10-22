import { useEffect, useState, useSyncExternalStore } from 'react'
import { canDownload, downloadedTitles, subscribeDownloads } from '../data/downloads.js'

// The titles downloaded on this device (data/downloads.js)
export const useDownloads = () => useSyncExternalStore(subscribeDownloads, downloadedTitles)

// Whether this page can download: true once the service worker controls it (it may take over after the first load)
export function useCanDownload() {
  const [able, setAble] = useState(canDownload)
  useEffect(() => {
    const sw = navigator.serviceWorker
    if (!sw) return undefined
    const check = () => setAble(canDownload())
    sw.addEventListener('controllerchange', check)
    return () => sw.removeEventListener('controllerchange', check)
  }, [])
  return able
}
