import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthShell } from '../components/AuthShell.jsx'
import { useAuth } from '../state/authContext.js'
import { useT } from '../state/useT.js'

export function Logout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const t = useT()
  const [signedOutName, setSignedOutName] = useState(null)

  if (signedOutName || !user) {
    return (
      <AuthShell title={t('You’re signed out')}>
        <p className="auth-copy">{signedOutName ? t('See you soon, {name}.', { name: signedOutName }) : t('You’re not signed in.')} {t('Your session data has been cleared from this browser.')}</p>
        <Link to="/login" className="cta">{t('Sign In Again')}</Link>
      </AuthShell>
    )
  }

  const confirm = () => {
    setSignedOutName(user.name)
    logout()
  }

  return (
    <AuthShell title={t('Sign out?')}>
      <p className="auth-copy">{t('You’re signed in as')} <b>{user.email}</b>. {t('Signing out clears your list, ratings and reviews for this session.')}</p>
      <button type="button" className="cta" onClick={confirm}>{t('Sign Out')}</button>
      <button type="button" className="ghost-cta" onClick={() => navigate(-1)}>{t('Cancel')}</button>
    </AuthShell>
  )
}
