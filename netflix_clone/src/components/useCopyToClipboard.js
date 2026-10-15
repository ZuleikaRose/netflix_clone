import { useEffect, useRef, useState } from 'react'

// Copies text and reports the outcome. The clipboard can be missing (plain-HTTP origins) or blocked
// by permissions, so failures surface as a status the UI can show instead of throwing.
export function useCopyToClipboard(resetMs = 2500) {
  const [copied, setCopied] = useState(null) // { key, ok } | null
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])

  const copy = async (key, text) => {
    let ok = true
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      ok = false
    }
    clearTimeout(timer.current)
    setCopied({ key, ok })
    // Keep failures visible longer so the user has time to copy by hand
    timer.current = setTimeout(() => setCopied(null), ok ? resetMs : resetMs * 3)
    return ok
  }

  return { copied, copy }
}
