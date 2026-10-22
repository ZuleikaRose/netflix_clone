import es from './es/index.js'

// Interface languages. English is the source: every translatable text is written in English in the code, and that
// English text is the key into the other languages' dictionaries (src/i18n/<code>/). So anything without a
// translation, including a message from a server, still shows, in English. Content (titles, synopses, cast, TMDB data)
// and the full legal documents aren't translated. `npm run lint` runs scripts/i18n-check.mjs, which fails when a
// t('…') text has no Spanish.
export const interfaceLanguages = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
]
const dictionaries = { es }

let current = 'en'
// AccessibilityProvider sets this as it renders, before its children, so tr() and locale() follow the menu
export function setCurrentLanguage(code) {
  current = dictionaries[code] ? code : 'en'
}

// `text` in `language`, with {name} placeholders filled from `vars`
export function translate(language, text, vars) {
  if (typeof text !== 'string') return text
  const template = (language !== 'en' && dictionaries[language]?.[text]) || text
  return vars ? template.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match)) : template
}

// For helpers that build text while a component renders (the component itself calls useT(), so it re-renders when
// the language changes)
export const tr = (text, vars) => translate(current, text, vars)
// For Intl date and number formats
export const locale = () => (current === 'es' ? 'es-US' : 'en-US')

// A first visit starts in the browser's language when it's one of ours
export const browserLanguage = () => (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('es') ? 'es' : 'en')
