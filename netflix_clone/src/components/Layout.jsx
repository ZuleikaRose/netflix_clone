import { useEffect } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { AccessibilityButton } from './AccessibilityButton.jsx'
import { AppNotices } from './AppNotices.jsx'
import { Icon } from './Icon.jsx'
import { Logo } from './Logo.jsx'
import { NotificationBell } from './NotificationBell.jsx'
import { ProfileAvatar } from './ProfileAvatar.jsx'
import { infoPages } from '../data/infoPages.js'
import { useProfile } from '../state/profileContext.js'
import { useT } from '../state/useT.js'
import { useWideScreen } from '../state/useWideScreen.js'

const navItems = [
  { to: '/', label: 'Home', icon: 'home', end: true },
  { to: '/games', label: 'Games', icon: 'games' },
  { to: '/new', label: 'New & Hot', icon: 'new' },
  { to: '/my-netflix', label: 'My App', icon: 'profile', also: ['/watchlist', '/favorites'] },
]

function NavLinks({ isTabActive }) {
  const t = useT()
  return navItems.map(({ to, label, icon, end, also }) => (
    <Link key={to} to={to} className={isTabActive({ to, end, also }) ? 'nav-item selected' : 'nav-item'} aria-current={isTabActive({ to, end, also }) ? 'page' : undefined}>
      <Icon name={icon} /><span>{t(label)}</span>
    </Link>
  ))
}

// Round "buy us a coffee" link to /donate: above the tab bar's right end on phones and tablets, in the bottom right
// corner on wide screens
function DonateLink({ pathname }) {
  const t = useT()
  return (
    <Link to="/donate" className="donate-fab" aria-label={t('Donate: buy us a coffee')} aria-current={pathname === '/donate' ? 'page' : undefined}>
      <Icon name="coffee" />
    </Link>
  )
}

export function Layout() {
  const { pathname } = useLocation()
  const t = useT()
  const wide = useWideScreen()
  const { profile } = useProfile()
  const isTabActive = ({ to, end, also = [] }) => (end ? pathname === to : pathname.startsWith(to)) || also.includes(pathname)
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <main className="app-shell">
      <div className="phone">
        {/* Wide screens: one top bar with the logo, the tabs and the header icons (page headers then show only their
            title and back button) */}
        {wide && (
          <header className="site-bar">
            <Link to="/" className="brand" aria-label={t('Home')}><Logo size={34} /></Link>
            <nav className="site-nav" aria-label={t('Main navigation')}>
              <NavLinks isTabActive={isTabActive} />
            </nav>
            <div className="top-actions">
              <AccessibilityButton />
              <Link to="/search" className="icon-button" aria-label={t('Search')}><Icon name="search" /></Link>
              <NotificationBell />
              <Link to="/my-netflix" className="avatar-hit" aria-label={t('My App profile')}><ProfileAvatar profile={profile} /></Link>
            </div>
          </header>
        )}
        <AppNotices />
        <div className="page" key={pathname}>
          <Outlet />
        </div>

        <footer className="legal">
          <nav aria-labelledby="legal-heading">
            <p id="legal-heading">{t('Legal')}</p>
            <ul>
              {infoPages.map(({ slug, label }) => <li key={slug}><Link to={`/info/${slug}`}>{t(label)}</Link></li>)}
            </ul>
          </nav>
        </footer>

        {wide
          ? <DonateLink pathname={pathname} />
          : (
            <nav className="bottom-nav" aria-label={t('Main navigation')}>
              <NavLinks isTabActive={isTabActive} />
              <DonateLink pathname={pathname} />
            </nav>
          )}
      </div>
    </main>
  )
}
