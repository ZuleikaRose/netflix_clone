import { Link } from 'react-router-dom'
import { Logo } from './Logo.jsx'
import { AccessibilityButton } from './AccessibilityButton.jsx'
import { useDocumentTitle } from './useDocumentTitle.js'

// Full-screen frame for signed-out pages: same phone chrome, no tab bar
export function AuthShell({ title, children }) {
  useDocumentTitle(title)
  return (
    <main className="app-shell">
      <div className="phone auth">
        <header className="auth-header">
          <Link to="/" className="brand" aria-label="Home"><Logo size={40} /></Link>
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
