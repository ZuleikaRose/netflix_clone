import { useState } from 'react'
import { useAuth } from '../state/authContext.js'
import { useMotionAllowed } from '../state/useMotionAllowed.js'

// Silent title previews (a slow pan standing in for a trailer clip). A preview starts by itself only when
// "Autoplay previews" is on, and never when motion is reduced; the toggle always lets the viewer pause or play it
// (WCAG 2.2.2). Moving to another title starts from the autoplay setting again.
export function usePreview(title) {
  const { user } = useAuth()
  const motionAllowed = useMotionAllowed()
  const [choice, setChoice] = useState({ id: null, playing: false })
  const chosen = choice.id === title.id ? choice.playing : user.preferences.autoplayPreviews
  const playing = motionAllowed && chosen
  return { playing, motionAllowed, toggle: () => setChoice({ id: title.id, playing: !playing }) }
}
