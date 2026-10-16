// Minimal static server for the production build, with history-API fallback for client-side routes and byte-range
// support (browsers need 206 responses to seek in <video>).
// Used by Playwright instead of `vite preview` so the tests don't depend on Vite's server (or editor plugins hooking it).
import { createReadStream, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve, sep } from 'node:path'

const root = resolve(process.argv[2] ?? 'dist')
const port = Number(process.argv[3] ?? 4173)

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.vtt': 'text/vtt; charset=utf-8',
}

// Parses a single "bytes=start-end" range (also "bytes=start-" and "bytes=-suffix"); null if absent or unusable
function byteRange(header, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header ?? '')
  if (!match || (match[1] === '' && match[2] === '')) return null
  const start = match[1] === '' ? Math.max(0, size - Number(match[2])) : Number(match[1])
  const end = match[1] === '' || match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1)
  return start <= end ? { start, end } : null
}

const isFile = (path) => {
  try {
    return statSync(path).isFile()
  } catch {
    return false
  }
}

createServer((req, res) => {
  let pathname
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
  } catch {
    // Malformed percent-encoding (e.g. /%E0%A4%A) would otherwise throw and crash the server
    res.writeHead(400).end('Bad request')
    return
  }

  // normalize() clamps '..' at '/'; the separator-aware check also rejects sibling folders like dist-old/
  const candidate = join(root, normalize(pathname))
  const insideRoot = candidate === root || candidate.startsWith(root + sep)
  const file = insideRoot && isFile(candidate) ? candidate : join(root, 'index.html')

  let size
  try {
    size = statSync(file).size
  } catch {
    res.writeHead(500).end()
    return
  }
  const headers = { 'Content-Type': contentTypes[extname(file)] ?? 'application/octet-stream', 'Accept-Ranges': 'bytes' }
  const range = req.headers.range ? byteRange(req.headers.range, size) : null
  if (req.headers.range && !range) {
    res.writeHead(416, { 'Content-Range': `bytes */${size}` }).end()
    return
  }
  const status = range ? 206 : 200
  if (range) headers['Content-Range'] = `bytes ${range.start}-${range.end}/${size}`
  headers['Content-Length'] = range ? range.end - range.start + 1 : size

  createReadStream(file, range ?? {})
    .on('open', () => res.writeHead(status, headers))
    .on('error', () => {
      if (!res.headersSent) res.writeHead(500)
      res.end()
    })
    .pipe(res)
}).listen(port, '127.0.0.1', () => console.log(`Serving ${root} on http://localhost:${port}`))
