import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon.jsx'
import { useMotionAllowed } from '../state/useMotionAllowed.js'

// Share of the visible width each arrow scrolls, so the next page keeps a little of the last one in view
const PAGE = 0.85
// Clicks this close together add up (a smooth scroll is still running); after that, paging starts from where the row is
const CLICK_STREAK_MS = 700

// A titled row of posters that scrolls sideways: swipe or use a trackpad, or page through it with the ‹ › buttons
// (desktop mice can't scroll sideways). A button at the row's end is marked unavailable but keeps focus, and both
// hide when every title already fits.
export function Row({ title, className = '', children }) {
  const rail = useRef(null)
  const target = useRef({ left: null, timer: null })
  const [edges, setEdges] = useState({ atStart: true, atEnd: true })
  const motionAllowed = useMotionAllowed()

  useEffect(() => {
    const el = rail.current
    const measure = () => {
      const atStart = el.scrollLeft <= 1
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1
      setEdges((prev) => (prev.atStart === atStart && prev.atEnd === atEnd ? prev : { atStart, atEnd }))
    }
    const frame = requestAnimationFrame(measure)
    el.addEventListener('scroll', measure, { passive: true })
    // The rail's width changes with the window; its content changes when titles arrive (TMDB rows load later)
    const resized = new ResizeObserver(measure)
    resized.observe(el)
    const changed = new MutationObserver(measure)
    changed.observe(el, { childList: true })
    const pending = target.current
    return () => {
      clearTimeout(pending.timer)
      cancelAnimationFrame(frame)
      el.removeEventListener('scroll', measure)
      resized.disconnect()
      changed.disconnect()
    }
  }, [])

  const page = (direction) => {
    const el = rail.current
    const pending = target.current
    const from = pending.left ?? el.scrollLeft
    const left = Math.max(0, Math.min(el.scrollWidth - el.clientWidth, from + direction * el.clientWidth * PAGE))
    clearTimeout(pending.timer)
    pending.left = left
    pending.timer = setTimeout(() => { pending.left = null }, CLICK_STREAK_MS)
    el.scrollTo({ left, behavior: motionAllowed ? 'smooth' : 'auto' })
  }
  const scrollable = !(edges.atStart && edges.atEnd)

  return (
    <section className={`row-section ${className}`.trim()}>
      <div className="section-heading">
        <h2>{title}</h2>
        {scrollable && (
          <div className="row-arrows">
            <button type="button" className="row-arrow" aria-label={`Scroll ${title} left`} aria-disabled={edges.atStart}
              onClick={() => !edges.atStart && page(-1)}><Icon name="back" /></button>
            <button type="button" className="row-arrow" aria-label={`Scroll ${title} right`} aria-disabled={edges.atEnd}
              onClick={() => !edges.atEnd && page(1)}><Icon name="chevron" /></button>
          </div>
        )}
      </div>
      <div className="rail" ref={rail}>{children}</div>
    </section>
  )
}
