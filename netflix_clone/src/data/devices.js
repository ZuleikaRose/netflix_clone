// A signed-in device as people recognise it, from its browser's user agent: "Chrome on Windows", "Safari on iPhone"
const browsers = [[/Edg\//, 'Edge'], [/OPR\/|Opera/, 'Opera'], [/Firefox\//, 'Firefox'], [/Chrome\//, 'Chrome'], [/Safari\//, 'Safari']]
const systems = [[/iPhone/, 'iPhone'], [/iPad/, 'iPad'], [/Android/, 'Android'], [/Windows/, 'Windows'], [/Mac OS X|Macintosh/, 'Mac'], [/CrOS/, 'ChromeOS'], [/Linux/, 'Linux']]

export function describeDevice(userAgent) {
  const browser = browsers.find(([pattern]) => pattern.test(userAgent))?.[1]
  const system = systems.find(([pattern]) => pattern.test(userAgent))?.[1]
  if (browser && system) return `${browser} on ${system}`
  return browser ?? system ?? 'Unknown device'
}

export const formatWhen = (date) => date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
