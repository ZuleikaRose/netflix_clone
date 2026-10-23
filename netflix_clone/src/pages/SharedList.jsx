import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AuthShell } from '../components/AuthShell.jsx'
import { PosterCard } from '../components/PosterCard.jsx'
import { fetchSharedList } from '../data/listsApi.js'
import { useAuth } from '../state/authContext.js'
import { useCatalog } from '../state/useCatalog.js'
import { useT } from '../state/useT.js'

// /shared/:slug: a list someone shared by link. Open to anyone, signed in or not.
export function SharedList() {
  const t = useT()
  const { slug } = useParams()
  const { session } = useAuth()
  const { findTitle } = useCatalog()
  const [found, setFound] = useState({ slug: null })

  useEffect(() => {
    let ignore = false
    fetchSharedList(slug)
      .then((list) => { if (!ignore) setFound({ slug, list }) })
      .catch(() => { if (!ignore) setFound({ slug, failed: true }) })
    return () => { ignore = true }
  }, [slug])

  const ready = found.slug === slug
  const list = ready ? found.list : null
  const titles = list ? list.titleIds.map(findTitle).filter(Boolean) : []
  const heading = !ready ? t('Shared list') : list ? list.name : t('List not found')

  return (
    <AuthShell title={heading}>
      {!ready && <p className="muted" role="status">{t('Loading the list…')}</p>}
      {ready && found.failed && <p className="form-alert" role="alert">{t('This list couldn’t be loaded. Please try again.')}</p>}
      {ready && !found.failed && !list && <p className="muted">{t('This list doesn’t exist, or its owner stopped sharing it.')}</p>}
      {list && (
        <div className="shared-list">
          <p className="muted">{titles.length === 1
            ? t('A list by {owner} · {count} title', { owner: list.owner, count: 1 })
            : t('A list by {owner} · {count} titles', { owner: list.owner, count: titles.length })}</p>
          {list.description && <p>{list.description}</p>}
          <ul className="poster-grid credit-grid">
            {titles.map((t) => (
              <li key={t.id}>
                <PosterCard title={t} />
                <p className="credit-role">{t.title}<span className="muted">{t.year}</span></p>
              </li>
            ))}
          </ul>
        </div>
      )}
      {ready && !session && (
        <p className="shared-join"><Link to="/signup" className="cta">{t('Join Netflix Clone')}</Link></p>
      )}
      {ready && session && <p><Link to="/" className="ghost-cta">{t('Back to Netflix Clone')}</Link></p>}
    </AuthShell>
  )
}
