import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon.jsx'
import { PageHeader } from '../components/PageHeader.jsx'
import { PosterCard } from '../components/PosterCard.jsx'
import { findTitle } from '../data/catalog.js'
import { useLibrary } from '../state/libraryContext.js'

const tabs = [
  { key: 'list', label: 'My List', empty: 'Tap “My List” on any title to save it for later.' },
  { key: 'favorites', label: 'Favorites', empty: 'Tap the heart on any title to add a favorite.' },
]

export function MyNetflix() {
  const library = useLibrary()
  const [tab, setTab] = useState('list')
  const active = tabs.find((t) => t.key === tab)
  const ids = tab === 'list' ? library.myList : library.favorites
  const remove = tab === 'list' ? library.toggleMyList : library.toggleFavorite

  return (
    <>
      <PageHeader title="My Netflix" />
      <section className="profile-card">
        <span className="avatar large" aria-hidden="true"><span /><span /><i /></span>
        <div>
          <h2>Alex</h2>
          <p className="muted">{library.myList.length} saved · {library.favorites.length} favorites · {Object.keys(library.ratings).length} rated</p>
        </div>
      </section>

      <div className="tabs" role="tablist" aria-label="Your titles">
        {tabs.map((t) => (
          <button key={t.key} role="tab" id={`tab-${t.key}`} aria-selected={tab === t.key} aria-controls="library-panel" className={tab === t.key ? 'tab active' : 'tab'} onClick={() => setTab(t.key)}>
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
              {ids.map(findTitle).map((t) => (
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
