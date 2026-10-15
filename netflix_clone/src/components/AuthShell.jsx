import { Link } from 'react-router-dom'

// Full-screen frame for signed-out pages: same phone chrome, no tab bar
export function AuthShell({ title, children }) {
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
