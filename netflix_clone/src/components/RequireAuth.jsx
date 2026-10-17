import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../state/authContext.js'

export function RequireAuth() {
  const { ready, user } = useAuth()
  const location = useLocation()
  // A saved session is still being restored after a reload: wait rather than bounce to /login
  if (!ready) return <p className="session-restoring" role="status">Signing you in…</p>
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  return <Outlet />
}
