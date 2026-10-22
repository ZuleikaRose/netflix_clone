import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon.jsx'
import { PageHeader } from '../components/PageHeader.jsx'
import { PosterCard } from '../components/PosterCard.jsx'
import { ProfileAvatar } from '../components/ProfileAvatar.jsx'
import { useProfile } from '../state/profileContext.js'
import { useLibrary } from '../state/libraryContext.js'
import { useCatalog } from '../state/useCatalog.js'

const tabs = [
  { key: 'list', path: '/watchlist', label: 'Watch list', empty: 'Tap “My List” on any title to add it to your watch list.' },
  { key: 'favorites', path: '/favorites', label: 'Favorites', empty: 'Tap the heart on any title to add a favorite.' },
]

export function MyNetflix() {
  const library = useLibrary()
  const { profile, profiles } = useProfile()
  const { findTitle } = useCatalog()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  // /my-netflix and /watchlist show the watch list; /favorites shows favorites
  const tab = pathname === '/favorites' ? 'favorites' : 'list'
  const active = tabs.find((t) => t.key === tab)
  const ids = tab === 'list' ? library.myList : library.favorites
  const remove = tab === 'list' ? library.toggleMyList : library.toggleFavorite

  return (
    <>
      <PageHeader title="My App" />
      <section className="profile-card">
        <ProfileAvatar profile={profile} large />
        <div>
          <h2>{profile.name}</h2>
          <p className="muted">{library.myList.length} saved · {library.favorites.length} favorites · {Object.keys(library.ratings).length} rated</p>
        </div>
        <div className="profile-links">
          <Link to="/profiles" className="account-link">{profiles.length > 1 ? 'Switch profile' : 'Profiles'}</Link>
          <Link to="/lists" className="account-link">My lists</Link>
          <Link to="/downloads" className="account-link">Downloads</Link>
          <Link to="/account" className="account-link">Account</Link>
        </div>
      </section>

      <div className="tabs" role="tablist" aria-label="Your titles">
        {tabs.map((t) => (
          <button key={t.key} role="tab" id={`tab-${t.key}`} aria-selected={tab === t.key} aria-controls="library-panel" className={tab === t.key ? 'tab active' : 'tab'} onClick={() => navigate(t.path, { replace: true })}>
            {t.label}
          </button>
        ))}
      </div>

      <section id="library-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {ids.length === 0
          ? (
            <div className="empty">
              <p>{active.empty}</p>
              <Link to="/" className="play wide">Browse titles</Link>
            </div>
          )
          : (
            <div className="poster-grid">
              {ids.map(findTitle).filter(Boolean).map((t) => (
                <PosterCard key={t.id} title={t}>
                  <button className="remove" aria-label={`Remove ${t.title} from ${active.label}`} onClick={() => remove(t.id)}><Icon name="close" /></button>
                </PosterCard>
              ))}
            </div>
          )}
      </section>
    </>
  )
}
