import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../state/authContext.js'
import { LibraryProvider } from '../state/LibraryProvider.jsx'
import { useProfile } from '../state/profileContext.js'
import { Layout } from './Layout.jsx'

// The signed-in pages need someone watching: until a profile is chosen, "Who's watching?" asks. Each profile gets its
// own library (lists, Continue Watching, scores), so LibraryProvider starts over when the profile changes.
export function RequireProfile() {
  const { session } = useAuth()
  const { profile } = useProfile()
  const location = useLocation()
  if (!profile) return <Navigate to="/profiles" replace state={{ from: location }} />
  return <LibraryProvider key={`${session}:${profile.id}`}><Layout /></LibraryProvider>
}
