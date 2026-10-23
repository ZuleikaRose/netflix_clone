import { Link } from 'react-router-dom'
import { NewListForm } from '../components/NewListForm.jsx'
import { PageHeader } from '../components/PageHeader.jsx'
import { useLibrary } from '../state/libraryContext.js'
import { useProfile } from '../state/profileContext.js'
import { useT } from '../state/useT.js'

// /lists: the profile's custom lists
export function MyLists() {
  const t = useT()
  const { lists } = useLibrary()
  const { profile } = useProfile()
  return (
    <>
      <PageHeader title={t('My lists')} back />
      <div className="settings">
        <section className="settings-card" aria-labelledby="new-list-heading">
          <h2 id="new-list-heading">{t('Make a list')}</h2>
          <p className="muted">{t('Group titles your way, like “Friday frights” or “Watch with Mum”, and share a list by link if you like.')}</p>
          <NewListForm label={t('List name')} />
        </section>
        <section className="settings-card" aria-labelledby="lists-heading">
          <h2 id="lists-heading">{t('{name}’s lists', { name: profile.name })}</h2>
          {lists.length === 0
            ? <p className="muted">{t('No lists yet.')}</p>
            : (
              <ul className="list-links">
                {lists.map((l) => (
                  <li key={l.id}>
                    <Link to={`/lists/${l.id}`}>
                      <span className="list-name">{l.name}</span>
                      <span className="muted">{l.titleIds.length === 1 ? t('{count} title', { count: 1 }) : t('{count} titles', { count: l.titleIds.length })}{l.isPublic && ` · ${t('Shared')}`}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
        </section>
      </div>
    </>
  )
}
