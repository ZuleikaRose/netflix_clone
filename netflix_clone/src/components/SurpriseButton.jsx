import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { pickSurprise } from '../data/surprise.js'
import { useCatalog } from '../state/useCatalog.js'
import { useLibrary } from '../state/libraryContext.js'

// The last pick, so pressing again (or coming back) shows something else
let previous = null

// Opens a random title the watching profile can watch (data/surprise.js); `type` follows Home's TV Shows / Movies chips
export function SurpriseButton({ type = null, className = 'ghost-cta surprise-button' }) {
  const navigate = useNavigate()
  const { titles } = useCatalog()
  const { reactions } = useLibrary()
  const [nothing, setNothing] = useState(false)

  const surprise = () => {
    const pick = pickSurprise(titles, reactions, { type, previous })
    setNothing(!pick)
    if (!pick) return
    previous = pick.id
    navigate(`/title/${pick.id}`)
  }

  return (
    <>
      <button type="button" className={className} onClick={surprise}><span aria-hidden="true">🎲</span> Surprise me</button>
      {nothing && <p className="muted" role="status">Nothing to pick for this profile right now.</p>}
    </>
  )
}
