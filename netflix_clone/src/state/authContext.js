import { createContext, useContext } from 'react'

export const AuthContext = createContext(null)

export function useAuth() {
  const auth = useContext(AuthContext)
  if (!auth) throw new Error('useAuth must be used inside <AuthProvider>')
  return auth
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// The same rules as Supabase Auth on both projects (Authentication → Sign In / Providers → Email: minimum length 13,
// lowercase, uppercase, digits and symbols required) and supabase/config.toml, so forms catch problems before a
// round trip. Supabase also rejects leaked passwords, which only it can check.
const MIN_PASSWORD = 13
export const PASSWORD_HINT = `At least ${MIN_PASSWORD} characters, with an uppercase and a lowercase letter, a number and a symbol.`
// The symbols Supabase counts
const SYMBOL = /[!@#$%^&*()_+\-=[\]{};'\\:"|<>?,./`~]/

// An error message for a new password, or null when it meets the rules
export function passwordProblem(password) {
  const missing = [
    password.length < MIN_PASSWORD && `at least ${MIN_PASSWORD} characters`,
    !/[a-z]/.test(password) && 'a lowercase letter',
    !/[A-Z]/.test(password) && 'an uppercase letter',
    !/[0-9]/.test(password) && 'a number',
    !SYMBOL.test(password) && 'a symbol',
  ].filter(Boolean)
  if (!missing.length) return null
  const list = missing.length > 1 ? `${missing.slice(0, -1).join(', ')} and ${missing.at(-1)}` : missing[0]
  return `Password needs ${list}.`
}

export const normalizeEmail = (email) => email.trim().toLowerCase()

// personalized: permission to use viewing activity for recommendations (outline §8). The maturity rating is per
// profile (data/profiles.js).
export const defaultPreferences = { autoplayNext: true, autoplayPreviews: false, emailUpdates: true, personalized: true, showOnLeaderboards: false }

// In-memory backend only. No password here: MemoryAuthProvider generates a random one per page load, and the demo
// button signs in via loginDemo(). With Supabase, each visitor gets their own demo account instead.
export const demoAccount = { name: 'Alex', email: 'alex@example.com', plan: 'standard' }
