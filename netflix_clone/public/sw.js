// Service worker: makes the app installable and lets it open without a connection.
// - The app shell (the page, manifest, icons) is cached at install; built assets (/assets/*, hashed, never change)
//   are cached the first time they load.
// - Page loads try the network first and fall back to the cached shell, so the app starts offline and its own
//   fallbacks take over (the built-in catalog, "You're offline").
// - Videos (/media, byte ranges), other sites (Supabase, TMDB, fonts) and anything but GET are left to the browser.
// Bump VERSION when this file's caching rules change; built assets are versioned by their file names.
const VERSION = 'v1'
const SHELL_CACHE = `shell-${VERSION}`
const ASSET_CACHE = `assets-${VERSION}`
const SHELL = ['/', '/manifest.webmanifest', '/favicon.svg', '/icons/icon-192.png', '/icons/icon-512.png']

// Keeps a copy for offline use; a full or blocked cache only means no offline copy, never a failed page
const keep = (cacheName, key, response) => caches.open(cacheName).then((cache) => cache.put(key, response)).catch(() => {})

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL)))
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = new Set([SHELL_CACHE, ASSET_CACHE])
    for (const name of await caches.keys()) if (!keep.has(name)) await caches.delete(name)
    await self.clients.claim()
  })())
})

// The page asks a waiting worker to take over when the member chooses "Reload" on the update notice
self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/media/')) return

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const page = await fetch(request)
        if (page.ok) event.waitUntil(keep(SHELL_CACHE, '/', page.clone()))
        return page
      } catch {
        return (await caches.match('/')) ?? Response.error()
      }
    })())
    return
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith((async () => {
      const cached = await caches.match(request)
      if (cached) return cached
      const response = await fetch(request)
      if (response.ok) event.waitUntil(keep(ASSET_CACHE, request, response.clone()))
      return response
    })())
  }
})
