import { Link } from 'react-router-dom'
import { Logo } from './Logo.jsx'
import { AccessibilityButton } from './AccessibilityButton.jsx'
import { useDocumentTitle } from './useDocumentTitle.js'
import { useT } from '../state/useT.js'

// Full-screen frame for signed-out pages: same phone chrome, no tab bar. `title` comes already translated.
export function AuthShell({ title, children }) {
  const t = useT()
  useDocumentTitle(title)
  return (
    <main className="app-shell">
      <div className="phone auth">
        <header className="auth-header">
          <Link to="/" className="brand" aria-label={t('Home')}><Logo size={40} /></Link>
          <AccessibilityButton />
        </header>
        <div className="auth-body page">
          <h1>{title}</h1>
          {children}
        </div>
      </div>
    </main>
  )
}
