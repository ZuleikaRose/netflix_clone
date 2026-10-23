import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon.jsx'
import { useT } from '../state/useT.js'

export function ShareButton({ title }) {
  const t = useT()
  const [status, setStatus] = useState('')
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])

  const url = `${window.location.origin}/title/${title.id}`

  const flash = (message, ms = 2500) => {
    clearTimeout(timer.current)
    setStatus(message)
    timer.current = setTimeout(() => setStatus(''), ms)
  }

  const share = async () => {
    // Native share sheet on phones; clipboard elsewhere
    if (navigator.share) {
      try {
        await navigator.share({ title: title.title, text: t('Watch {title} with me', { title: title.title }), url })
        return
      } catch (err) {
        if (err.name === 'AbortError') return // user closed the sheet
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      flash(t('Link copied'))
    } catch {
      // Clipboard can be blocked (insecure origin, permissions) — show the link instead of failing silently
      flash(t('Copy this link: {url}', { url }), 8000)
    }
  }

  return (
    <>
      <button type="button" className="ghost-action" onClick={share}>
        <Icon name="share" /><span>{t('Share')}</span>
      </button>
      <p className="share-status" role="status">{status}</p>
    </>
  )
}
