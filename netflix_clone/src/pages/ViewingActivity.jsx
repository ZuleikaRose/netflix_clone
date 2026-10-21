import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader.jsx'
import { episodeCode, findEpisode } from '../data/episodes.js'
import { useAuth } from '../state/authContext.js'
import { useLibrary } from '../state/libraryContext.js'
import { useProfile } from '../state/profileContext.js'
import { useCatalog } from '../state/useCatalog.js'

const retentionChoices = [
  { value: '', label: 'Keep until I delete it' },
  { value: '90', label: 'Delete after 90 days' },
  { value: '365', label: 'Delete after 1 year' },
]

const formatDay = (day) => new Date(`${day}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

// "Behind the Glass: S1:E2 The Signal" for a catalog episode, else the title's name
function describe(title, episode) {
  const found = episode ? findEpisode(title, episode) : null
  return found ? `${title.title}: ${episodeCode(found)} ${found.name}` : title.title
}

// A CSV the member can keep: date, title, episode
function downloadCsv(rows) {
  const quote = (value) => `"${String(value).replaceAll('"', '""')}"`
  const csv = ['Date,Title,Episode', ...rows.map((r) => [r.day, r.title, r.episode].map(quote).join(','))].join('\n')
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  link.download = 'viewing-activity.csv'
  link.click()
  URL.revokeObjectURL(link.href)
}

// /history: what this profile watched, day by day, with ways to hide entries and the account's history settings
export function ViewingActivity() {
  const { loadHistory, hideFromHistory, clearHistory } = useLibrary()
  const { user, setPreference } = useAuth()
  const { profile } = useProfile()
  const { findTitle } = useCatalog()
  const [entries, setEntries] = useState(null)
  const [failed, setFailed] = useState(false)
  const [error, setError] = useState(null)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    let ignore = false
    loadHistory()
      .then((found) => { if (!ignore) setEntries(found) })
      .catch(() => { if (!ignore) setFailed(true) })
    return () => { ignore = true }
    // Read once per visit; changes on this page update the list directly
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const rows = (entries ?? []).map((e) => ({ ...e, titleData: findTitle(e.titleId) })).filter((e) => e.titleData)
    .map((e) => ({ ...e, title: describe(e.titleData, e.episode), episode: e.episode || '' }))
  const days = [...new Set(rows.map((r) => r.day))]

  const hide = async (entry) => {
    const problem = await hideFromHistory(entry.id)
    setError(problem)
    if (!problem) setEntries((all) => all.filter((e) => e.id !== entry.id))
  }
  const hideAll = async () => {
    const problem = await clearHistory()
    setError(problem)
    setConfirming(false)
    if (!problem) setEntries([])
  }

  return (
    <>
      <PageHeader title="Viewing activity" back />
      <div className="settings">
        <section className="settings-card" aria-labelledby="history-settings-heading">
          <h2 id="history-settings-heading">History settings</h2>
          <label className="switch-row">
            <span>
              <span className="switch-label">Keep viewing history</span>
              <span className="muted">Turned off, nothing you watch is added to any profile’s history. What’s already here stays until you hide it.</span>
            </span>
            <input type="checkbox" role="switch" checked={user.preferences.keepHistory !== false} onChange={(e) => setPreference('keepHistory', e.target.checked)} />
          </label>
          <label className="select-row">
            <span className="switch-label">Delete old history automatically</span>
            <select value={user.preferences.historyRetention ?? ''} onChange={(e) => setPreference('historyRetention', e.target.value ? Number(e.target.value) : null)}>
              {retentionChoices.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </label>
        </section>

        <section className="settings-card" aria-labelledby="history-heading">
          <h2 id="history-heading">{profile.name}’s history</h2>
          {error && <p className="form-alert" role="alert">{error}</p>}
          {failed && <p className="form-alert" role="alert">Your viewing history couldn’t be loaded. Please try again.</p>}
          {!failed && !entries && <p className="muted" role="status">Loading your history…</p>}
          {entries && rows.length === 0 && <p className="muted">Nothing here yet. Titles you watch show up here, one entry per day.</p>}
          {days.map((day) => (
            <div key={day} className="history-day">
              <h3>{formatDay(day)}</h3>
              <ul className="history-list">
                {rows.filter((r) => r.day === day).map((r) => (
                  <li key={r.id}>
                    <Link to={r.titleData.path ?? `/title/${r.titleData.id}`} className="history-title">{r.title}</Link>
                    <button type="button" className="ghost-cta history-hide" aria-label={`Hide ${r.title} from history`} onClick={() => hide(r)}>Hide</button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {rows.length > 0 && (
            <div className="history-actions">
              <Link to="/year-in-review" className="ghost-cta">See your Year in Review</Link>
              <button type="button" className="ghost-cta" onClick={() => downloadCsv(rows)}>Download all (CSV)</button>
              {confirming
                ? (
                  <div className="confirm-row" role="group" aria-label="Hide all history">
                    <p>Hide all of {profile.name}’s viewing history? This can’t be undone.</p>
                    <button type="button" className="cta delete-fill" onClick={hideAll}>Hide all</button>
                    <button type="button" className="ghost-cta" onClick={() => setConfirming(false)}>Cancel</button>
                  </div>
                )
                : <button type="button" className="ghost-cta danger" onClick={() => setConfirming(true)}>Hide all…</button>}
            </div>
          )}
        </section>
      </div>
    </>
  )
}
