import { useEffect, useRef } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { AppNotices } from './AppNotices.jsx'
import { Icon } from './Icon.jsx'
import { infoPages } from '../data/infoPages.js'

const navItems = [
  { to: '/', label: 'Home', icon: 'home', end: true },
  { to: '/games', label: 'Games', icon: 'games' },
  { to: '/new', label: 'New & Hot', icon: 'new' },
  { to: '/my-netflix', label: 'My App', icon: 'profile', also: ['/watchlist', '/favorites'] },
]


export function Layout() {
  const { pathname } = useLocation()
  const isTabActive = ({ to, end, also = [] }) => (end ? pathname === to : pathname.startsWith(to)) || also.includes(pathname)
  const phoneRef = useRef(null)

  // The phone frame is the scroll container on desktop; the window is on mobile — reset both on navigation
  useEffect(() => {
    window.scrollTo(0, 0)
    phoneRef.current?.scrollTo(0, 0)
  }, [pathname])

  return (
    <main className="app-shell">
      <div className="phone" ref={phoneRef}>
        <AppNotices />
        <div className="page" key={pathname}>
          <Outlet />
        </div>

        <footer className="legal">
          <nav aria-labelledby="legal-heading">
            <p id="legal-heading">Legal</p>
            <ul>
              {infoPages.map(({ slug, label }) => <li key={slug}><Link to={`/info/${slug}`}>{label}</Link></li>)}
            </ul>
          </nav>
        </footer>

        <nav className="bottom-nav" aria-label="Main navigation">
          {navItems.map(({ to, label, icon, end, also }) => (
            <Link key={to} to={to} className={isTabActive({ to, end, also }) ? 'nav-item selected' : 'nav-item'} aria-current={isTabActive({ to, end, also }) ? 'page' : undefined}>
              <Icon name={icon} /><span>{label}</span>
            </Link>
          ))}
          {/* Floats just above the tab bar's right end, so it stays pinned to the phone frame on desktop too */}
          <Link to="/donate" className="donate-fab" aria-label="Donate: buy us a coffee" aria-current={pathname === '/donate' ? 'page' : undefined}>
            <Icon name="coffee" />
          </Link>
        </nav>
      </div>
    </main>
  )
}
