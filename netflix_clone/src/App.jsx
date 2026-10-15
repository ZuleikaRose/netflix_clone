import { useState } from 'react'

const photos = [
  'https://images.unsplash.com/photo-1778585040075-0991abfd4ed9?auto=format&fit=crop&w=800&q=85',
  'https://images.unsplash.com/photo-1733232073397-80fb13ef3212?auto=format&fit=crop&w=500&q=80',
  'https://images.unsplash.com/photo-1634840150834-f6d4544f5b9b?auto=format&fit=crop&w=500&q=80',
  'https://images.unsplash.com/photo-1614201842267-206a09286c3b?auto=format&fit=crop&w=500&q=80',
]

const iconPaths = {
  home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5M9 21v-7h6v7" /></>,
  games: <><path d="M8.5 7h7a6.5 6.5 0 0 1 6.2 8.5l-1 3a2.8 2.8 0 0 1-4.5 1.2L14 18h-4l-2.2 1.7a2.8 2.8 0 0 1-4.5-1.2l-1-3A6.5 6.5 0 0 1 8.5 7Z" /><path d="M7 11v4M5 13h4M17 12h.01M19 15h.01" /></>,
  new: <><path d="M4 5h16v14H4z" /><path d="m10 9 5 3-5 3Z" /></>,
  profile: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  chevron: <path d="m9 18 6-6-6-6" />,
}

function Icon({ name }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true">{iconPaths[name]}</svg>
}

const titles = ['THE VEIL', 'NIGHT SHIFT', 'AFTER DARK', 'THE SIGNAL']

const navItems = [
  ['Home', 'home'],
  ['Games', 'games'],
  ['New & Hot', 'new'],
  ['My Netflix', 'profile'],
]

function App() {
  const [tab, setTab] = useState('Home')
  const [filter, setFilter] = useState('TV Shows')
  const [saved, setSaved] = useState(false)

  return (
    <main className="app-shell">
      <div className="phone">
        <header className="topbar">
          <div className="brand">N</div>
          <div className="top-actions">
            <button className="icon-button" aria-label="Search"><Icon name="search" /></button>
            <button className="avatar-hit" aria-label="Profile"><span className="avatar" aria-hidden="true"><span /><span /><i /></span></button>
          </div>
        </header>

        <section className="filters" aria-label="Browse filters">
          {['TV Shows', 'Movies'].map((item) => (
            <button key={item} className={filter === item ? 'chip active' : 'chip'} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item}</button>
          ))}
          <button className="chip">Categories <span aria-hidden="true">⌄</span></button>
        </section>

        <section className="hero">
          <img src={photos[0]} alt="Two hands behind textured glass" />
          <div className="hero-shade" />
          <div className="hero-copy">
            <p className="eyebrow"><b>N</b> SERIES</p>
            <h1 className="hero-title">BEHIND<br />THE GLASS</h1>
            <p className="meta">Dark &nbsp;·&nbsp; Suspenseful &nbsp;·&nbsp; Mystery</p>
            <div className="hero-actions">
              <button className="play"><span aria-hidden="true">▶</span> Play</button>
              <button className={saved ? 'secondary saved' : 'secondary'} aria-pressed={saved} onClick={() => setSaved(!saved)}>
                <Icon name={saved ? 'check' : 'plus'} /> {saved ? 'Saved' : 'My List'}
              </button>
            </div>
          </div>
        </section>

        <div className="content">
          <section className="row-section">
            <div className="section-heading"><h2>Continue Watching for Alex</h2><Icon name="chevron" /></div>
            <div className="rail">
              {photos.slice(1).map((photo, index) => (
                <article className="poster" key={photo}>
                  <img src={photo} alt="" />
                  <span className="poster-title">{titles[index + 1]}</span>
                  <button aria-label={`Resume ${titles[index + 1]}`} className="resume">▶</button>
                  <div className="progress"><span style={{ width: `${38 + index * 19}%` }} /></div>
                </article>
              ))}
            </div>
          </section>

          <section className="row-section ranking">
            <div className="section-heading"><h2>Top 10 in the U.S. Today</h2><Icon name="chevron" /></div>
            <div className="rail">
              {[0, 1, 2].map((index) => (
                <article className="rank-card" key={index}>
                  <span aria-hidden="true">{index + 1}</span>
                  <img src={photos[(index + 2) % photos.length]} alt={`#${index + 1}: ${titles[(index + 2) % titles.length]}`} />
                  <b aria-hidden="true">TOP<br /><em>10</em></b>
                </article>
              ))}
            </div>
          </section>
        </div>

        <nav className="bottom-nav" aria-label="Main navigation">
          {navItems.map(([label, icon]) => (
            <button key={label} className={tab === label ? 'nav-item selected' : 'nav-item'} aria-current={tab === label ? 'page' : undefined} onClick={() => setTab(label)}>
              <Icon name={icon} /><span>{label}</span>
            </button>
          ))}
        </nav>
      </div>
    </main>
  )
}

export default App
