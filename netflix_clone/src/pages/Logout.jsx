import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthShell } from '../components/AuthShell.jsx'
import { useAuth } from '../state/authContext.js'

export function Logout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [signedOutName, setSignedOutName] = useState(null)

  if (signedOutName || !user) {
    return (
      <AuthShell title="You’re signed out">
        <p className="auth-copy">{signedOutName ? `See you soon, ${signedOutName}.` : 'You’re not signed in.'} Your session data has been cleared from this browser.</p>
        <Link to="/login" className="cta">Sign In Again</Link>
      </AuthShell>
    )
  }

  const confirm = () => {
    setSignedOutName(user.name)
    logout()
  }

  return (
    <AuthShell title="Sign out?">
      <p className="auth-copy">You’re signed in as <b>{user.email}</b>. Signing out clears your list, ratings and reviews for this session.</p>
      <button type="button" className="cta" onClick={confirm}>Sign Out</button>
      <button type="button" className="ghost-cta" onClick={() => navigate(-1)}>Cancel</button>
    </AuthShell>
  )
}
