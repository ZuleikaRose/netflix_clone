import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader.jsx'
import { personPath } from '../data/people.js'
import { reviewYear, shareText } from '../data/yearInReview.js'
import { useLibrary } from '../state/libraryContext.js'
import { useProfile } from '../state/profileContext.js'
import { useCatalog } from '../state/useCatalog.js'
import { useT } from '../state/useT.js'
import { locale } from '../i18n/index.js'

// Shares the summary with the phone's share sheet, or copies it; shows the text when neither works
function ShareSummary({ text }) {
  const t = useT()
  const [status, setStatus] = useState('')
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: t('My Year in Review'), text })
        return
      } catch (error) {
        if (error.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(text)
      setStatus(t('Summary copied'))
    } catch {
      setStatus(t('Copy this summary: {text}', { text }))
    }
  }
  return (
    <>
      <button type="button" className="cta" onClick={share}>{t('Share my year')}</button>
      <p className="share-status" role="status">{status}</p>
    </>
  )
}

// /year-in-review: the watching profile's year, from its viewing history
export function YearInReview() {
  const t = useT()
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
      <PageHeader title={t('Year in Review')} back />
      <div className="settings year-review">
        <section className="settings-card year-hero" aria-labelledby="year-heading">
          <h2 id="year-heading">{t('{name}’s {year}', { name: profile.name, year })}</h2>
          {years.length > 1 && (
            <label className="select-row">
              <span className="switch-label">{t('Year')}</span>
              <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
          )}
          {!current && <p className="muted" role="status">{t('Looking back at {year}…', { year })}</p>}
          {current?.failed && <p className="form-alert" role="alert">{t('Your year couldn’t be loaded. Please try again.')}</p>}
          {current?.summary && !stats && (
            <p className="muted">{t('Nothing watched in {year} yet. Titles you watch are counted from your', { year })} <Link to="/history" className="inline-link">{t('viewing activity')}</Link>.</p>
          )}
        </section>

        {stats && (
          <>
            <ul className="year-stats" aria-label={t('{year} in numbers', { year })}>
              <li><b>{stats.titles}</b><span>{stats.titles === 1 ? t('title') : t('titles')}</span></li>
              <li><b>{stats.episodes}</b><span>{stats.episodes === 1 ? t('episode') : t('episodes')}</span></li>
              <li><b>{stats.hours}</b><span>{stats.hours === 1 ? t('hour (about)') : t('hours (about)')}</span></li>
              <li><b>{stats.days}</b><span>{stats.days === 1 ? t('day watching') : t('days watching')}</span></li>
            </ul>

            <section className="settings-card" aria-labelledby="year-highlights-heading">
              <h2 id="year-highlights-heading">{t('Highlights')}</h2>
              <dl className="year-facts">
                {stats.mostWatched && (
                  <div><dt>{t('Most watched')}</dt><dd><Link to={stats.mostWatched.path ?? `/title/${stats.mostWatched.id}`} className="inline-link">{stats.mostWatched.title}</Link></dd></div>
                )}
                {stats.topGenres.length > 0 && <div><dt>{t('Top genres')}</dt><dd>{stats.topGenres.map((g) => t(g)).join(', ')}</dd></div>}
                {stats.topPerson && <div><dt>{t('Seen most')}</dt><dd><Link to={personPath(stats.topPerson)} className="inline-link">{stats.topPerson}</Link></dd></div>}
                <div><dt>{t('Longest streak')}</dt><dd>{stats.streak === 1
                  ? t('{count} day in a row', { count: (1).toLocaleString(locale()) })
                  : t('{count} days in a row', { count: stats.streak.toLocaleString(locale()) })}</dd></div>
                <div><dt>{t('Busiest month')}</dt><dd>{stats.busiestMonth}</dd></div>
              </dl>
              <ShareSummary text={shareText(year, stats)} />
            </section>
            <p className="muted year-note">{t('Hours are estimated from each title’s running time. Hidden history isn’t counted.')}</p>
          </>
        )}
      </div>
    </>
  )
}
