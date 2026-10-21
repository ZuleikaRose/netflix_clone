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

// Longer biographies start folded to this many characters
const SHORT_BIO = 480

function Biography({ person }) {
  const [open, setOpen] = useState(false)
  if (!person.biography) return <p className="muted">TMDB has no biography for {person.name} yet.</p>
  const long = person.biography.length > SHORT_BIO
  const text = long && !open ? `${person.biography.slice(0, SHORT_BIO).replace(/\s+\S*$/, '')}…` : person.biography
  return (
    <div className="biography" id="biography">
      {text.split(/\n+/).map((paragraph, i) => <p key={i}>{paragraph}</p>)}
      {long && (
        <button type="button" className="ghost-cta" aria-expanded={open} aria-controls="biography" onClick={() => setOpen(!open)}>
          {open ? 'Show less' : 'Read more'}
        </button>
      )}
    </div>
  )
}

// /tmdb/person/:personId: an actor or director from TMDB, with their best-known movies and shows
export function TmdbPerson() {
  const { personId } = useParams()
  const validId = /^\d+$/.test(personId)
  const { status, person } = useTmdbPerson(validId ? personId : null)
  const { isAllowed } = useCatalog()
  useDocumentTitle(person?.name)

  if (!validId || status === 'missing') return <NotFound />
  if (status !== 'ready') {
    return (
      <>
        <PageHeader title="Person" back />
        <div className="empty" role="status">
          <p>{status === 'loading' ? 'Loading from TMDB…' : 'TMDB isn’t available right now. Please try again later.'}</p>
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
            {person.knownFor && <><dt>Known for</dt><dd>{person.knownFor}</dd></>}
            {person.born && <><dt>Born</dt><dd>{formatDay(person.born)}{!person.died && ` (age ${ageOn(person.born)})`}</dd></>}
            {person.died && <><dt>Died</dt><dd>{formatDay(person.died)}{person.born && ` (aged ${ageOn(person.born, person.died)})`}</dd></>}
            {person.birthplace && <><dt>Birthplace</dt><dd>{person.birthplace}</dd></>}
          </dl>
        </div>
        <Biography person={person} />
        <p><a href={person.tmdbUrl} className="inline-link" target="_blank" rel="noreferrer">View {person.name} on TMDB</a></p>

        <div className="section-heading"><h2>Known for</h2></div>
        {hidden > 0 && <p className="muted">{hidden} more {hidden === 1 ? 'is' : 'are'} hidden by this profile’s maturity setting.</p>}
        {shown.length === 0
          ? <p className="muted">No titles to show.</p>
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
