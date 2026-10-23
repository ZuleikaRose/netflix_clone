import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader.jsx'
import { PosterCard } from '../components/PosterCard.jsx'
import { TmdbCredit } from '../components/TmdbCredit.jsx'
import { useDocumentTitle } from '../components/useDocumentTitle.js'
import { ageOn, formatDay } from '../data/people.js'
import { useCatalog } from '../state/useCatalog.js'
import { useTmdbPerson } from '../state/useTmdb.js'
import { NotFound } from './NotFound.jsx'
import { useT } from '../state/useT.js'

// Longer biographies start folded to this many characters
const SHORT_BIO = 480

function Biography({ person }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  if (!person.biography) return <p className="muted">{t('TMDB has no biography for {name} yet.', { name: person.name })}</p>
  const long = person.biography.length > SHORT_BIO
  const text = long && !open ? `${person.biography.slice(0, SHORT_BIO).replace(/\s+\S*$/, '')}…` : person.biography
  return (
    <div className="biography" id="biography">
      {text.split(/\n+/).map((paragraph, i) => <p key={i}>{paragraph}</p>)}
      {long && (
        <button type="button" className="ghost-cta" aria-expanded={open} aria-controls="biography" onClick={() => setOpen(!open)}>
          {open ? t('Show less') : t('Read more')}
        </button>
      )}
    </div>
  )
}

// /tmdb/person/:personId: an actor or director from TMDB, with their best-known movies and shows
export function TmdbPerson() {
  const t = useT()
  const { personId } = useParams()
  const validId = /^\d+$/.test(personId)
  const { status, person } = useTmdbPerson(validId ? personId : null)
  const { isAllowed } = useCatalog()
  useDocumentTitle(person?.name)

  if (!validId || status === 'missing') return <NotFound />
  if (status !== 'ready') {
    return (
      <>
        <PageHeader title={t('Person')} back />
        <div className="empty" role="status">
          <p>{status === 'loading' ? t('Loading from TMDB…') : t('TMDB isn’t available right now. Please try again later.')}</p>
        </div>
      </>
    )
  }

  const shown = person.credits.filter(isAllowed)
  const hidden = person.credits.length - shown.length
  return (
    <>
      <PageHeader title={person.name} back />
      <div className="person">
        <div className="person-intro">
          {person.photo && <img src={person.photo} alt="" className="person-photo" />}
          <dl className="person-facts">
            {person.knownFor && <><dt>{t('Known for')}</dt><dd>{t(person.knownFor)}</dd></>}
            {person.born && <><dt>{t('Born')}</dt><dd>{formatDay(person.born)}{!person.died && ` (${t('age {age}', { age: ageOn(person.born) })})`}</dd></>}
            {person.died && <><dt>{t('Died')}</dt><dd>{formatDay(person.died)}{person.born && ` (${t('aged {age}', { age: ageOn(person.born, person.died) })})`}</dd></>}
            {person.birthplace && <><dt>{t('Birthplace')}</dt><dd>{person.birthplace}</dd></>}
          </dl>
        </div>
        <Biography person={person} />
        <p><a href={person.tmdbUrl} className="inline-link" target="_blank" rel="noreferrer">{t('View {title} on TMDB', { title: person.name })}</a></p>

        <div className="section-heading"><h2>{t('Known for')}</h2></div>
        {hidden > 0 && (
          <p className="muted">{hidden === 1
            ? t('{count} more is hidden by this profile’s maturity setting.', { count: hidden })
            : t('{count} more are hidden by this profile’s maturity setting.', { count: hidden })}</p>
        )}
        {shown.length === 0
          ? <p className="muted">{t('No titles to show.')}</p>
          : (
            <ul className="poster-grid credit-grid">
              {shown.map((t) => (
                <li key={t.id}>
                  <PosterCard title={t} />
                  <p className="credit-role">{t.title}{t.role && <span className="muted">{t.role}</span>}</p>
                </li>
              ))}
            </ul>
          )}
        <TmdbCredit />
      </div>
    </>
  )
}
