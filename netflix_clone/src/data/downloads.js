import { captionLanguages, clipFor, clipSources } from './clips.js'
import { readStored, writeStored } from '../lib/supabaseConfig.js'

// Offline downloads: a title's sample clip, captions and seek previews are saved in the browser's Cache Storage
// (DOWNLOAD_CACHE), and public/sw.js answers /media requests from it, byte ranges included, so the player works
// without a connection. Which titles are downloaded is kept per device (STORAGE_KEY). Catalog titles share clips, so
// a clip's files stay until no downloaded title uses them.
export const DOWNLOAD_CACHE = 'downloads' // the same name in public/sw.js, which never deletes it
const STORAGE_KEY = 'netflix-clone-downloads'

const listeners = new Set()
const notify = () => listeners.forEach((listener) => listener())
export function subscribeDownloads(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// [{ titleId, clipId, bytes, at }], oldest first. readStored tolerates blocked storage.
let downloads = readStored(STORAGE_KEY) ?? []
export const downloadedTitles = () => downloads
const save = (next) => {
  downloads = next
  writeStored(STORAGE_KEY, next)
  notify()
}

// Downloads need Cache Storage and a service worker controlling the page (production builds, see lib/pwa.js)
export const canDownload = () => typeof caches !== 'undefined' && Boolean(navigator.serviceWorker?.controller)

// The one video file this browser will play (Playwright's Chromium only plays WebM), its captions and previews
function filesFor(clip) {
  const sources = clipSources(clip)
  const webm = document.createElement('video').canPlayType('video/webm; codecs="vp9, opus"')
  return [
    webm ? sources.webm : sources.mp4,
    ...captionLanguages.map((l) => clipSources(clip, l.code).captions),
    sources.thumbs,
  ]
}

export function formatSize(bytes) {
  return bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1e3))} KB`
}

// Saves the title's files; resolves to an error message or null
export async function downloadTitle(titleId) {
  if (downloads.some((d) => d.titleId === titleId)) return null
  const clip = clipFor(titleId)
  try {
    const cache = await caches.open(DOWNLOAD_CACHE)
    let bytes = 0
    for (const url of filesFor(clip)) {
      let response = await cache.match(url)
      if (!response) {
        response = await fetch(url, { cache: 'no-store' })
        if (!response.ok) throw new Error(`${url}: ${response.status}`)
        await cache.put(url, response.clone())
      }
      bytes += (await response.blob()).size
    }
    save([...downloads.filter((d) => d.titleId !== titleId), { titleId, clipId: clip.id, bytes, at: new Date().toISOString() }])
    return null
  } catch (error) {
    if (import.meta.env.DEV) console.warn('Download:', error)
    // QuotaExceededError: the device is out of space for this site
    return error?.name === 'QuotaExceededError'
      ? 'There isn’t enough space on this device. Remove a download and try again.'
      : 'The download didn’t finish. Check your connection and try again.'
  }
}

// Forgets the title, and deletes its clip's files once no other download uses them
export async function removeDownload(titleId) {
  const gone = downloads.find((d) => d.titleId === titleId)
  if (!gone) return
  const rest = downloads.filter((d) => d.titleId !== titleId)
  save(rest)
  if (rest.some((d) => d.clipId === gone.clipId)) return
  try {
    const cache = await caches.open(DOWNLOAD_CACHE)
    const clip = clipFor(titleId)
    const { webm, mp4 } = clipSources(clip)
    await Promise.all([webm, mp4, ...filesFor(clip)].map((url) => cache.delete(url)))
  } catch {
    // The files go when the browser clears the site's storage anyway
  }
}
