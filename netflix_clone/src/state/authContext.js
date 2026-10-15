import { createContext, useContext } from 'react'

export const AuthContext = createContext(null)

export function useAuth() {
  const auth = useContext(AuthContext)
  if (!auth) throw new Error('useAuth must be used inside <AuthProvider>')
  return auth
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const MIN_PASSWORD = 8

// No password here: AuthProvider generates a random one per page load, and the demo button signs in via loginDemo()
export const demoAccount = { name: 'Alex', email: 'alex@example.com', plan: 'standard' }
