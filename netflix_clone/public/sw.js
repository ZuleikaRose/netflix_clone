// Service worker: makes the app installable and lets it open without a connection.
// - The app shell (the page, manifest, icons) is cached at install; built assets (/assets/*, hashed, never change)
//   are cached the first time they load.
// - Page loads try the network first and fall back to the cached shell, so the app starts offline and its own
//   fallbacks take over (the built-in catalog, "You're offline").
// - Downloaded titles (data/downloads.js) are kept in the DOWNLOAD_CACHE, which is never deleted here: /media requests
//   are answered from it when the file is there, byte ranges included (video seeks ask for them), so they play offline.
//   Other /media requests go to the network as usual.
// - Other sites (Supabase, TMDB, fonts) and anything but GET are left to the browser.
// Bump VERSION when this file's caching rules change; built assets are versioned by their file names.
const VERSION = 'v2'
const SHELL_CACHE = `shell-${VERSION}`
const ASSET_CACHE = `assets-${VERSION}`
const DOWNLOAD_CACHE = 'downloads' // as in src/data/downloads.js
const SHELL = ['/', '/manifest.webmanifest', '/favicon.svg', '/icons/icon-192.png', '/icons/icon-512.png']

// Keeps a copy for offline use; a full or blocked cache only means no offline copy, never a failed page
const keep = (cacheName, key, response) => caches.open(cacheName).then((cache) => cache.put(key, response)).catch(() => {})

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL)))
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = new Set([SHELL_CACHE, ASSET_CACHE, DOWNLOAD_CACHE])
    for (const name of await caches.keys()) if (!keep.has(name)) await caches.delete(name)
    await self.clients.claim()
  })())
})

// The page asks a waiting worker to take over when the member chooses "Reload" on the update notice
self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting()
})

// A downloaded file, or the part a "Range: bytes=start-end" header asks for (206 Partial Content)
async function fromDownloads(request, url) {
  const cache = await caches.open(DOWNLOAD_CACHE)
  const cached = await cache.match(url.pathname)
  if (!cached) return null
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') ?? '')
  if (!range) return cached
  const body = await cached.blob()
  const size = body.size
  let start = range[1] === '' ? size - Number(range[2]) : Number(range[1])
  let end = range[1] === '' || range[2] === '' ? size - 1 : Math.min(Number(range[2]), size - 1)
  start = Math.max(0, start)
  if (start >= size || start > end) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
  }
  end = Math.max(start, end)
  return new Response(body.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': cached.headers.get('Content-Type') ?? body.type,
      'Content-Length': String(end - start + 1),
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Accept-Ranges': 'bytes',
    },
  })
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  if (url.pathname.startsWith('/media/')) {
    event.respondWith((async () => (await fromDownloads(request, url).catch(() => null)) ?? fetch(request))())
    return
  }

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
