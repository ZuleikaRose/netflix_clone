import { createContext, useContext } from 'react'

export const AuthContext = createContext(null)

export function useAuth() {
  const auth = useContext(AuthContext)
  if (!auth) throw new Error('useAuth must be used inside <AuthProvider>')
  return auth
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const MIN_PASSWORD = 8

export const normalizeEmail = (email) => email.trim().toLowerCase()

// personalized: permission to use viewing activity for recommendations (outline §8)
export const defaultPreferences = { autoplayNext: true, autoplayPreviews: false, emailUpdates: true, personalized: true, maturity: 'all' }

// In-memory backend only. No password here: MemoryAuthProvider generates a random one per page load, and the demo
// button signs in via loginDemo(). With Supabase, each visitor gets their own demo account instead.
export const demoAccount = { name: 'Alex', email: 'alex@example.com', plan: 'standard' }
