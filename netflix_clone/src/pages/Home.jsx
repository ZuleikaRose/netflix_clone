import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon.jsx'
import { PosterCard } from '../components/PosterCard.jsx'
import { useAuth } from '../state/authContext.js'
import { useCatalog } from '../state/useCatalog.js'
import { useLibrary } from '../state/libraryContext.js'

const filters = [['TV Shows', 'show'], ['Movies', 'movie']]

function Row({ title, children }) {
  return (
    <section className="row-section">
      <div className="section-heading"><h2>{title}</h2><Icon name="chevron" /></div>
      <div className="rail">{children}</div>
    </section>
  )
}

export function Home() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { myList, toggleMyList } = useLibrary()
  const [type, setType] = useState(null)
  const { titles: catalog } = useCatalog()

  const titles = type ? catalog.filter((t) => t.type === type) : catalog
  const featured = [...titles].sort((a, b) => b.popularity - a.popularity)[0]
  const continueWatching = titles.filter((t) => t.progress)
  const top10 = titles.filter((t) => t.top10).sort((a, b) => a.top10 - b.top10)
  const newReleases = titles.filter((t) => t.isNew && t.id !== featured?.id)
  const saved = featured && myList.includes(featured.id)
  const [first, ...rest] = featured ? featured.title.toUpperCase().split(' ') : []

  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand" aria-label="Home">N</Link>
        <div className="top-actions">
          <Link to="/search" className="icon-button" aria-label="Search"><Icon name="search" /></Link>
          <Link to="/my-netflix" className="avatar-hit" aria-label="My Netflix profile"><span className="avatar" aria-hidden="true"><span /><span /><i /></span></Link>
        </div>
      </header>

      <section className="filters" aria-label="Browse filters">
        {filters.map(([label, value]) => (
          <button key={value} className={type === value ? 'chip active' : 'chip'} aria-pressed={type === value} onClick={() => setType(type === value ? null : value)}>{label}</button>
        ))}
        <button className="chip" onClick={() => navigate('/search')}>Categories <span aria-hidden="true">⌄</span></button>
      </section>

      {!featured && (
        <div className="empty home-empty">
          <p>Nothing here for this profile’s maturity setting.</p>
          <Link to="/account" className="play wide">Change in Account</Link>
        </div>
      )}

      {featured && <section className="hero">
        <img src={featured.image} alt="" style={{ filter: featured.tint }} />
        <div className="hero-shade" />
        <div className="hero-copy">
          <p className="eyebrow"><b>N</b> {featured.type === 'show' ? 'SERIES' : 'FILM'}</p>
          <h1 className="hero-title">{first}<br />{rest.join(' ')}</h1>
          <p className="meta">{featured.mood.join('  ·  ')}</p>
          <div className="hero-actions">
            <button className="play" onClick={() => navigate(`/title/${featured.id}?play=1`)}><span aria-hidden="true">▶</span> Play</button>
            <button className={saved ? 'secondary saved' : 'secondary'} aria-pressed={saved} onClick={() => toggleMyList(featured.id)}>
              <Icon name={saved ? 'check' : 'plus'} /> {saved ? 'Saved' : 'My List'}
            </button>
          </div>
        </div>
      </section>}

      <div className="content">
        {continueWatching.length > 0 && (
          <Row title={`Continue Watching for ${user.name}`}>
            {continueWatching.map((t) => (
              <PosterCard key={t.id} title={t}>
                <Link to={`/title/${t.id}?play=1`} aria-label={`Resume ${t.title}`} className="resume"><span aria-hidden="true">▶</span></Link>
                <div className="progress"><span style={{ width: `${t.progress}%` }} /></div>
              </PosterCard>
            ))}
          </Row>
        )}

        {top10.length > 0 && (
          <section className="row-section ranking">
            <div className="section-heading"><h2>Top 10 in the U.S. Today</h2><Icon name="chevron" /></div>
            <div className="rail">
              {top10.map((t) => (
                <Link to={`/title/${t.id}`} className="rank-card" key={t.id} aria-label={`#${t.top10}: ${t.title}`}>
                  <span aria-hidden="true">{t.top10}</span>
                  <img src={t.image} alt="" style={{ filter: t.tint }} />
                  <b aria-hidden="true">TOP<br /><em>10</em></b>
                </Link>
              ))}
            </div>
          </section>
        )}

        {newReleases.length > 0 && (
          <Row title="New on Netflix">
            {newReleases.map((t) => <PosterCard key={t.id} title={t} />)}
          </Row>
        )}
      </div>
    </>
  )
}
