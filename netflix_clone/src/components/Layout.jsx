import { useEffect, useRef } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Icon } from './Icon.jsx'
import { infoPages } from '../data/infoPages.js'

const navItems = [
  { to: '/', label: 'Home', icon: 'home', end: true },
  { to: '/games', label: 'Games', icon: 'games' },
  { to: '/new', label: 'New & Hot', icon: 'new' },
  { to: '/my-netflix', label: 'My Netflix', icon: 'profile' },
]


export function Layout() {
  const { pathname } = useLocation()
  const phoneRef = useRef(null)

  // The phone frame is the scroll container on desktop; the window is on mobile — reset both on navigation
  useEffect(() => {
    window.scrollTo(0, 0)
    phoneRef.current?.scrollTo(0, 0)
  }, [pathname])

  return (
    <main className="app-shell">
      <div className="phone" ref={phoneRef}>
        <div className="page" key={pathname}>
          <Outlet />
        </div>

        <footer className="legal" aria-label="Legal">
          <p>Legal</p>
          <ul>
            {infoPages.map(({ slug, label }) => <li key={slug}><Link to={`/info/${slug}`}>{label}</Link></li>)}
          </ul>
        </footer>

        <nav className="bottom-nav" aria-label="Main navigation">
          {navItems.map(({ to, label, icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'nav-item selected' : 'nav-item')}>
              <Icon name={icon} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </main>
  )
}
