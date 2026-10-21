import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader.jsx'
import { personPath } from '../data/people.js'
import { reviewYear, shareText } from '../data/yearInReview.js'
import { useLibrary } from '../state/libraryContext.js'
import { useProfile } from '../state/profileContext.js'
import { useCatalog } from '../state/useCatalog.js'

const plural = (n, one, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`

// Shares the summary with the phone's share sheet, or copies it; shows the text when neither works
function ShareSummary({ text }) {
  const [status, setStatus] = useState('')
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'My Year in Review', text })
        return
      } catch (error) {
        if (error.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(text)
      setStatus('Summary copied')
    } catch {
      setStatus(`Copy this summary: ${text}`)
    }
  }
  return (
    <>
      <button type="button" className="cta" onClick={share}>Share my year</button>
      <p className="share-status" role="status">{status}</p>
    </>
  )
}

// /year-in-review: the watching profile's year, from its viewing history
export function YearInReview() {
  const thisYear = new Date().getFullYear()
  const { loadYear } = useLibrary()
  const { profile } = useProfile()
  const { findTitle } = useCatalog()
  const [year, setYear] = useState(thisYear)
  const [loaded, setLoaded] = useState(null) // { year, summary } | { year, failed: true }

  useEffect(() => {
    let ignore = false
    loadYear(year)
      .then((summary) => { if (!ignore) setLoaded({ year, summary }) })
      .catch(() => { if (!ignore) setLoaded({ year, failed: true }) })
    return () => { ignore = true }
    // loadYear changes with every library update; the year is what matters
  }, [year]) // eslint-disable-line react-hooks/exhaustive-deps

  const current = loaded?.year === year ? loaded : null
  const stats = current?.summary ? reviewYear(current.summary, findTitle) : null
  const years = [...new Set([thisYear, ...(loaded?.summary?.years ?? [])])].sort((a, b) => b - a)

  return (
    <>
      <PageHeader title="Year in Review" back />
      <div className="settings year-review">
        <section className="settings-card year-hero" aria-labelledby="year-heading">
          <h2 id="year-heading">{profile.name}’s {year}</h2>
          {years.length > 1 && (
            <label className="select-row">
              <span className="switch-label">Year</span>
              <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
          )}
          {!current && <p className="muted" role="status">Looking back at {year}…</p>}
          {current?.failed && <p className="form-alert" role="alert">Your year couldn’t be loaded. Please try again.</p>}
          {current?.summary && !stats && (
            <p className="muted">Nothing watched in {year} yet. Titles you watch are counted from your <Link to="/history" className="inline-link">viewing activity</Link>.</p>
          )}
        </section>

        {stats && (
          <>
            <ul className="year-stats" aria-label={`${year} in numbers`}>
              <li><b>{stats.titles}</b><span>{stats.titles === 1 ? 'title' : 'titles'}</span></li>
              <li><b>{stats.episodes}</b><span>{stats.episodes === 1 ? 'episode' : 'episodes'}</span></li>
              <li><b>{stats.hours}</b><span>{stats.hours === 1 ? 'hour' : 'hours'} (about)</span></li>
              <li><b>{stats.days}</b><span>{stats.days === 1 ? 'day watching' : 'days watching'}</span></li>
            </ul>

            <section className="settings-card" aria-labelledby="year-highlights-heading">
              <h2 id="year-highlights-heading">Highlights</h2>
              <dl className="year-facts">
                {stats.mostWatched && (
                  <div><dt>Most watched</dt><dd><Link to={stats.mostWatched.path ?? `/title/${stats.mostWatched.id}`} className="inline-link">{stats.mostWatched.title}</Link></dd></div>
                )}
                {stats.topGenres.length > 0 && <div><dt>Top genres</dt><dd>{stats.topGenres.join(', ')}</dd></div>}
                {stats.topPerson && <div><dt>Seen most</dt><dd><Link to={personPath(stats.topPerson)} className="inline-link">{stats.topPerson}</Link></dd></div>}
                <div><dt>Longest streak</dt><dd>{plural(stats.streak, 'day')} in a row</dd></div>
                <div><dt>Busiest month</dt><dd>{stats.busiestMonth}</dd></div>
              </dl>
              <ShareSummary text={shareText(year, stats)} />
            </section>
            <p className="muted year-note">Hours are estimated from each title’s running time. Hidden history isn’t counted.</p>
          </>
        )}
      </div>
    </>
  )
}
