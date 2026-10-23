import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon.jsx'
import { PageHeader } from '../components/PageHeader.jsx'
import { PosterCard } from '../components/PosterCard.jsx'
import { ProfileAvatar } from '../components/ProfileAvatar.jsx'
import { useProfile } from '../state/profileContext.js'
import { useLibrary } from '../state/libraryContext.js'
import { useCatalog } from '../state/useCatalog.js'
import { useT } from '../state/useT.js'

const tabs = [
  { key: 'list', path: '/watchlist', label: 'Watch list', empty: 'Tap “My List” on any title to add it to your watch list.' },
  { key: 'favorites', path: '/favorites', label: 'Favorites', empty: 'Tap the heart on any title to add a favorite.' },
]

export function MyNetflix() {
  const t = useT()
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
      <PageHeader title={t('My App')} />
      <section className="profile-card">
        <ProfileAvatar profile={profile} large />
        <div>
          <h2>{profile.name}</h2>
          <p className="muted">{t('{saved} saved · {favorites} favorites · {rated} rated', { saved: library.myList.length, favorites: library.favorites.length, rated: Object.keys(library.ratings).length })}</p>
        </div>
        <div className="profile-links">
          <Link to="/profiles" className="account-link">{profiles.length > 1 ? t('Switch profile') : t('Profiles')}</Link>
          <Link to="/lists" className="account-link">{t('My lists')}</Link>
          <Link to="/downloads" className="account-link">{t('Downloads')}</Link>
          <Link to="/account" className="account-link">{t('Account')}</Link>
        </div>
      </section>

      <div className="tabs" role="tablist" aria-label={t('Your titles')}>
        {tabs.map((item) => (
          <button key={item.key} role="tab" id={`tab-${item.key}`} aria-selected={tab === item.key} aria-controls="library-panel" className={tab === item.key ? 'tab active' : 'tab'} onClick={() => navigate(item.path, { replace: true })}>
            {t(item.label)}
          </button>
        ))}
      </div>

      <section id="library-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {ids.length === 0
          ? (
            <div className="empty">
              <p>{t(active.empty)}</p>
              <Link to="/" className="play wide">{t('Browse titles')}</Link>
            </div>
          )
          : (
            <div className="poster-grid">
              {ids.map(findTitle).filter(Boolean).map((item) => (
                <PosterCard key={item.id} title={item}>
                  <button className="remove" aria-label={t('Remove {title} from {list}', { title: item.title, list: t(active.label) })} onClick={() => remove(item.id)}><Icon name="close" /></button>
                </PosterCard>
              ))}
            </div>
          )}
      </section>
    </>
  )
}
