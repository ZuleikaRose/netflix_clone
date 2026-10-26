import { useSyncExternalStore } from 'react'

// Notebooks, desktops, Chromebooks and tablets held sideways (1024px and wider): the app shows a top bar instead of
// the bottom tab bar, and page headers drop the logo and icons the top bar already has. Keep in step with the
// `min-width: 1024px` rules in index.css.
export const WIDE_SCREEN = '(min-width: 1024px)'

const query = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(WIDE_SCREEN) : null
const subscribe = (onChange) => {
  query?.addEventListener('change', onChange)
  return () => query?.removeEventListener('change', onChange)
}

export function useWideScreen() {
  return useSyncExternalStore(subscribe, () => query?.matches ?? false, () => false)
}
