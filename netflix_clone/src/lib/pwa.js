// Installable app: registers the service worker (public/sw.js) in production builds, keeps the browser's install
// prompt for the Account page, and notices when a new version is waiting. Components subscribe through the hooks in
// state/usePwa.js.

const listeners = new Set()
const state = { installPrompt: null, installed: false, updateWaiting: null }
const notify = () => listeners.forEach((listener) => listener())

export const pwaState = () => state
export function subscribePwa(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// Opened from the home screen (or the installed desktop app)
export const runningInstalled = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true

// Chromium browsers offer installing through this event; it can fire before any component mounts, so it's caught here
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault()
  state.installPrompt = event
  notify()
})
window.addEventListener('appinstalled', () => {
  state.installPrompt = null
  state.installed = true
  notify()
})

// Shows the browser's install dialog; resolves to true when the member accepted
export async function promptInstall() {
  const prompt = state.installPrompt
  if (!prompt) return false
  let outcome = 'dismissed'
  try {
    await prompt.prompt()
    outcome = (await prompt.userChoice).outcome
  } catch {
    // The browser refused to show it again (each prompt event can be used once)
  }
  state.installPrompt = null
  if (outcome === 'accepted') state.installed = true
  notify()
  return outcome === 'accepted'
}

// Lets the waiting version take over, then reloads into it
export function applyUpdate() {
  const waiting = state.updateWaiting
  if (!waiting) return
  navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true })
  waiting.postMessage('skip-waiting')
}

export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      const watch = (worker) => worker?.addEventListener('statechange', () => {
        // Installed while another version controls the page: a new version is ready
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          state.updateWaiting = worker
          notify()
        }
      })
      if (registration.waiting && navigator.serviceWorker.controller) {
        state.updateWaiting = registration.waiting
        notify()
      }
      watch(registration.installing)
      registration.addEventListener('updatefound', () => watch(registration.installing))
    }).catch((error) => {
      if (import.meta.env.DEV) console.warn('Service worker:', error)
    })
  })
}
