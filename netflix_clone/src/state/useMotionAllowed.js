import { useSyncExternalStore } from 'react'
import { useAccessibility } from './accessibilityContext.js'

const query = '(prefers-reduced-motion: reduce)'
const subscribe = (onChange) => {
  const media = window.matchMedia(query)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}
const prefersReducedMotion = () => window.matchMedia(query).matches

// False when the system asks for reduced motion or "Stop animations" is on in the accessibility menu
export function useMotionAllowed() {
  const { settings } = useAccessibility()
  const reduced = useSyncExternalStore(subscribe, prefersReducedMotion)
  return !reduced && !settings.stopAnimations
}
