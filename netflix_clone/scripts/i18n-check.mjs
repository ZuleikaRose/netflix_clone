// Checks the Spanish interface (src/i18n): every literal text passed to t() or tr() in src/ has a Spanish entry with
// the same {placeholders}, no two dictionary files translate the same text differently, and no t() call builds its
// text with a template literal (changing parts belong in vars). Run by `npm run lint`; exits 1 with a list otherwise.
import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const src = join(root, 'src')
const dictionaryDir = join(src, 'i18n', 'es')

async function sourceFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = await Promise.all(entries.map((e) => {
    const path = join(dir, e.name)
    if (e.isDirectory()) return path === join(src, 'i18n') ? [] : sourceFiles(path)
    return /\.(js|jsx)$/.test(e.name) ? [path] : []
  }))
  return files.flat()
}

const unescape = (text, quote) => text.replace(new RegExp(`\\\\${quote}`, 'g'), quote).replace(/\\\\/g, '\\')
const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',')

const problems = []
const used = new Map() // English text → first place it's used

for (const file of await sourceFiles(src)) {
  const code = await readFile(file, 'utf8')
  const lines = code.split('\n')
  lines.forEach((line, i) => {
    // Examples in comments aren't calls
    if (/^\s*(\/\/|\*)/.test(line)) return
    const where = `${relative(root, file)}:${i + 1}`
    for (const m of line.matchAll(/(?<![\w.])(?:t|tr)\(\s*(['"])((?:\\.|(?!\1).)*)\1/g)) {
      const text = unescape(m[2], m[1])
      if (!used.has(text)) used.set(text, where)
    }
    if (/(?<![\w.])(?:t|tr)\(\s*`[^`]*\$\{/.test(line)) problems.push(`${where}: build the text with vars, not a template literal`)
  })
}

const merged = {}
for (const name of (await readdir(dictionaryDir)).filter((n) => n !== 'index.js' && n.endsWith('.js'))) {
  const { default: part } = await import(pathToFileURL(join(dictionaryDir, name)).href)
  for (const [english, spanish] of Object.entries(part)) {
    if (english in merged && merged[english].spanish !== spanish) {
      problems.push(`"${english}" is translated differently in ${merged[english].file} and ${name}`)
    }
    if (placeholders(english) !== placeholders(spanish)) {
      problems.push(`"${english}" (${name}): the Spanish needs the same {placeholders}`)
    }
    merged[english] ??= { spanish, file: name }
  }
}

for (const [text, where] of used) {
  if (!(text in merged)) problems.push(`${where}: no Spanish for "${text}"`)
}

if (problems.length) {
  console.error(`i18n-check: ${problems.length} problem${problems.length === 1 ? '' : 's'}`)
  for (const p of problems) console.error(`  ${p}`)
  process.exit(1)
}
console.log(`i18n-check: ${used.size} texts, all translated`)
