import { Link } from 'react-router-dom'
import { useDocumentTitle } from './useDocumentTitle.js'

// Full-screen frame for signed-out pages: same phone chrome, no tab bar
export function AuthShell({ title, children }) {
  useDocumentTitle(title)
  return (
    <main className="app-shell">
      <div className="phone auth">
        <header className="auth-header">
          <Link to="/" className="wordmark" aria-label="Netflix home">NETFLIX</Link>
        </header>
        <div className="auth-body page">
          <h1>{title}</h1>
          {children}
        </div>
      </div>
    </main>
  )
}
