// Minimal static server for the production build, with history-API fallback for client-side routes.
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

  createReadStream(file)
    .on('open', () => res.writeHead(200, { 'Content-Type': contentTypes[extname(file)] ?? 'application/octet-stream' }))
    .on('error', () => {
      if (!res.headersSent) res.writeHead(500)
      res.end()
    })
    .pipe(res)
}).listen(port, '127.0.0.1', () => console.log(`Serving ${root} on http://localhost:${port}`))
