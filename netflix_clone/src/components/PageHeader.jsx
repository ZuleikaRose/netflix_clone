import { Link, useNavigate } from 'react-router-dom'
import { Icon } from './Icon.jsx'
import { Logo } from './Logo.jsx'
import { AccessibilityButton } from './AccessibilityButton.jsx'
import { NotificationBell } from './NotificationBell.jsx'
import { useDocumentTitle } from './useDocumentTitle.js'
import { useT } from '../state/useT.js'

// `title` comes already translated
export function PageHeader({ title, back = false }) {
  const t = useT()
  const navigate = useNavigate()
  useDocumentTitle(title)

  return (
    <header className="page-header">
      {back
        ? <button className="icon-button" aria-label={t('Go back')} onClick={() => navigate(-1)}><Icon name="back" /></button>
        : <Link to="/" className="brand" aria-label={t('Home')}><Logo size={30} /></Link>}
      <h1>{title}</h1>
      <div className="header-actions">
        <AccessibilityButton />
        <Link to="/search" className="icon-button" aria-label={t('Search')}><Icon name="search" /></Link>
        <NotificationBell />
      </div>
    </header>
  )
}
