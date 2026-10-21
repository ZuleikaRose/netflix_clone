import { Link } from 'react-router-dom'
import { NewListForm } from '../components/NewListForm.jsx'
import { PageHeader } from '../components/PageHeader.jsx'
import { useLibrary } from '../state/libraryContext.js'
import { useProfile } from '../state/profileContext.js'

// /lists: the profile's custom lists
export function MyLists() {
  const { lists } = useLibrary()
  const { profile } = useProfile()
  return (
    <>
      <PageHeader title="My lists" back />
      <div className="settings">
        <section className="settings-card" aria-labelledby="new-list-heading">
          <h2 id="new-list-heading">Make a list</h2>
          <p className="muted">Group titles your way, like “Friday frights” or “Watch with Mum”, and share a list by link if you like.</p>
          <NewListForm label="List name" />
        </section>
        <section className="settings-card" aria-labelledby="lists-heading">
          <h2 id="lists-heading">{profile.name}’s lists</h2>
          {lists.length === 0
            ? <p className="muted">No lists yet.</p>
            : (
              <ul className="list-links">
                {lists.map((l) => (
                  <li key={l.id}>
                    <Link to={`/lists/${l.id}`}>
                      <span className="list-name">{l.name}</span>
                      <span className="muted">{l.titleIds.length} {l.titleIds.length === 1 ? 'title' : 'titles'}{l.isPublic && ' · Shared'}</span>
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
