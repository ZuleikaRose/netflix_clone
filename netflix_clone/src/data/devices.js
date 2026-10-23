import { locale, tr } from '../i18n/index.js'

// A signed-in device as people recognise it, from its browser's user agent: "Chrome on Windows", "Safari on iPhone"
const browsers = [[/Edg\//, 'Edge'], [/OPR\/|Opera/, 'Opera'], [/Firefox\//, 'Firefox'], [/Chrome\//, 'Chrome'], [/Safari\//, 'Safari']]
const systems = [[/iPhone/, 'iPhone'], [/iPad/, 'iPad'], [/Android/, 'Android'], [/Windows/, 'Windows'], [/Mac OS X|Macintosh/, 'Mac'], [/CrOS/, 'ChromeOS'], [/Linux/, 'Linux']]

export function describeDevice(userAgent) {
  const browser = browsers.find(([pattern]) => pattern.test(userAgent))?.[1]
  const system = systems.find(([pattern]) => pattern.test(userAgent))?.[1]
  if (browser && system) return tr('{browser} on {system}', { browser, system })
  return browser ?? system ?? tr('Unknown device')
}

export const formatWhen = (date) => date.toLocaleString(locale(), { dateStyle: 'medium', timeStyle: 'short' })
