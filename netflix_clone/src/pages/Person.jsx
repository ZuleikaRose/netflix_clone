import { useParams } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader.jsx'
import { PosterCard } from '../components/PosterCard.jsx'
import { useDocumentTitle } from '../components/useDocumentTitle.js'
import { catalogCredits } from '../data/people.js'
import { useCatalog } from '../state/useCatalog.js'
import { NotFound } from './NotFound.jsx'
import { useT } from '../state/useT.js'

// /people/:name: everything a catalog actor, director or writer is in (the built-in titles' people are fictional, so
// they have no TMDB page)
export function Person() {
  const t = useT()
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
        <p className="muted">{roles.map((role) => t(role)).join(' · ')} · {credits.length === 1
          ? t('{count} title on Netflix Clone', { count: 1 })
          : t('{count} titles on Netflix Clone', { count: credits.length })}</p>
        {shown.length < credits.length && (
          <p className="muted">{credits.length - shown.length === 1
            ? t('{count} more is hidden by this profile’s maturity setting.', { count: 1 })
            : t('{count} more are hidden by this profile’s maturity setting.', { count: credits.length - shown.length })}</p>
        )}
        <div className="section-heading"><h2>{t('Titles')}</h2></div>
        <ul className="poster-grid credit-grid">
          {shown.map(({ title, roles: did }) => (
            <li key={title.id}>
              <PosterCard title={title} />
              <p className="credit-role">{title.title}<span className="muted">{did.map((role) => t(role)).join(', ')}</span></p>
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}
