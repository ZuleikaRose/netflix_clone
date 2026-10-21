import { useParams } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader.jsx'
import { PosterCard } from '../components/PosterCard.jsx'
import { useDocumentTitle } from '../components/useDocumentTitle.js'
import { catalogCredits } from '../data/people.js'
import { useCatalog } from '../state/useCatalog.js'
import { NotFound } from './NotFound.jsx'

// /people/:name: everything a catalog actor, director or writer is in (the built-in titles' people are fictional, so
// they have no TMDB page)
export function Person() {
  const { name } = useParams()
  const { all, isAllowed } = useCatalog()
  const credits = catalogCredits(all, name)
  const shown = credits.filter((c) => isAllowed(c.title))
  useDocumentTitle(credits.length ? name : null)

  if (!credits.length) return <NotFound />
  const roles = [...new Set(credits.flatMap((c) => c.roles))]
  return (
    <>
      <PageHeader title={name} back />
      <div className="person">
        <p className="muted">{roles.join(' · ')} · {credits.length} {credits.length === 1 ? 'title' : 'titles'} on Netflix Clone</p>
        {shown.length < credits.length && (
          <p className="muted">{credits.length - shown.length} more {credits.length - shown.length === 1 ? 'is' : 'are'} hidden by this profile’s maturity setting.</p>
        )}
        <div className="section-heading"><h2>Titles</h2></div>
        <ul className="poster-grid credit-grid">
          {shown.map(({ title, roles: did }) => (
            <li key={title.id}>
              <PosterCard title={title} />
              <p className="credit-role">{title.title}<span className="muted">{did.join(', ')}</span></p>
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}
