// Time-based one-time codes (RFC 6238: HMAC-SHA1, 30-second steps, six digits), as authenticator apps make them.
// Supabase Auth checks codes itself; this is for the in-memory accounts (and the tests that type a code). SHA-1 is
// written out here because crypto.subtle is missing on plain-HTTP origins (e.g. the dev server on a LAN address).

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const STEP_SECONDS = 30
const DIGITS = 6

export const CODE_PATTERN = /^\d{6}$/

// A random 160-bit key in base32, the form authenticator apps take ("setup key")
export function newTotpKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(20))
  let bits = ''
  for (const b of bytes) bits += b.toString(2).padStart(8, '0')
  return bits.match(/.{5}/g).map((chunk) => BASE32[parseInt(chunk, 2)]).join('')
}

function decodeBase32(key) {
  const bits = [...key.replace(/=+$/, '').toUpperCase()].map((c) => BASE32.indexOf(c).toString(2).padStart(5, '0')).join('')
  return Uint8Array.from(bits.match(/.{8}/g) ?? [], (byte) => parseInt(byte, 2))
}

function sha1(bytes) {
  const words = []
  const length = bytes.length
  const padded = new Uint8Array(((length + 9 + 63) >> 6) << 6)
  padded.set(bytes)
  padded[length] = 0x80
  new DataView(padded.buffer).setUint32(padded.length - 4, length * 8)
  for (let i = 0; i < padded.length; i += 4) words.push(new DataView(padded.buffer).getUint32(i))
  let [a, b, c, d, e] = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0]
  const rotate = (x, n) => (x << n) | (x >>> (32 - n))
  for (let block = 0; block < words.length; block += 16) {
    const w = words.slice(block, block + 16)
    for (let i = 16; i < 80; i++) w[i] = rotate(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1)
    let [h0, h1, h2, h3, h4] = [a, b, c, d, e]
    for (let i = 0; i < 80; i++) {
      const [f, k] = i < 20 ? [(h1 & h2) | (~h1 & h3), 0x5a827999]
        : i < 40 ? [h1 ^ h2 ^ h3, 0x6ed9eba1]
          : i < 60 ? [(h1 & h2) | (h1 & h3) | (h2 & h3), 0x8f1bbcdc]
            : [h1 ^ h2 ^ h3, 0xca62c1d6]
      const next = (rotate(h0, 5) + f + h4 + k + w[i]) | 0
      ;[h4, h3, h2, h1, h0] = [h3, h2, rotate(h1, 30), h0, next]
    }
    ;[a, b, c, d, e] = [(a + h0) | 0, (b + h1) | 0, (c + h2) | 0, (d + h3) | 0, (e + h4) | 0]
  }
  const out = new Uint8Array(20)
  const view = new DataView(out.buffer)
  ;[a, b, c, d, e].forEach((h, i) => view.setUint32(i * 4, h >>> 0))
  return out
}

function hmacSha1(key, message) {
  const block = new Uint8Array(64)
  block.set(key.length > 64 ? sha1(key) : key)
  const inner = new Uint8Array(64 + message.length)
  const outer = new Uint8Array(64 + 20)
  for (let i = 0; i < 64; i++) {
    inner[i] = block[i] ^ 0x36
    outer[i] = block[i] ^ 0x5c
  }
  inner.set(message, 64)
  outer.set(sha1(inner), 64)
  return sha1(outer)
}

// The code for `key` at `time` (milliseconds)
export function totpCode(key, time = Date.now()) {
  const counter = new Uint8Array(8)
  new DataView(counter.buffer).setUint32(4, Math.floor(time / 1000 / STEP_SECONDS))
  const hash = hmacSha1(decodeBase32(key), counter)
  const offset = hash[19] & 0xf
  const value = new DataView(hash.buffer).getUint32(offset) & 0x7fffffff
  return String(value % 10 ** DIGITS).padStart(DIGITS, '0')
}

// Accepts the current code and the ones either side of it, for clocks that are a little out
export const checkTotpCode = (key, code, time = Date.now()) =>
  [-1, 0, 1].some((step) => totpCode(key, time + step * STEP_SECONDS * 1000) === code)

// What authenticator apps scan (otpauth:// URI)
export const totpUri = (key, account, issuer = 'Netflix Clone') =>
  `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?secret=${key}&issuer=${encodeURIComponent(issuer)}&period=${STEP_SECONDS}&digits=${DIGITS}`
