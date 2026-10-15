import { useMemo, useState } from 'react'
import { AuthContext, demoAccount } from './authContext.js'

// Front-end only: accounts live in memory and vanish on refresh. Never use this pattern with real credentials.

const defaultPreferences = { autoplayNext: true, autoplayPreviews: false, emailUpdates: true, maturity: 'all' }

const normalize = (email) => email.trim().toLowerCase()

export function AuthProvider({ children }) {
  const [accounts, setAccounts] = useState(() => [{ ...demoAccount, password: crypto.randomUUID(), preferences: defaultPreferences }])
  const [currentEmail, setCurrentEmail] = useState(null)
  // Bumped on every sign-in/out so per-session stores (My List, ratings…) start fresh
  const [session, setSession] = useState(0)

  const value = useMemo(() => {
    const user = accounts.find((a) => a.email === currentEmail) ?? null
    const patchUser = (patch) => setAccounts((all) => all.map((a) => (a.email === currentEmail ? { ...a, ...patch } : a)))

    return {
      user,
      session,
      login(email, password) {
        const account = accounts.find((a) => a.email === normalize(email))
        if (!account || account.password !== password) return 'Incorrect email or password.'
        setCurrentEmail(account.email)
        setSession((n) => n + 1)
        return null
      },
      loginDemo() {
        setCurrentEmail(demoAccount.email)
        setSession((n) => n + 1)
      },
      signup({ name, email, password, plan }) {
        const key = normalize(email)
        if (accounts.some((a) => a.email === key)) return 'An account with this email already exists.'
        setAccounts((all) => [...all, { name: name.trim(), email: key, password, plan, preferences: defaultPreferences }])
        setCurrentEmail(key)
        setSession((n) => n + 1)
        return null
      },
      logout() {
        setCurrentEmail(null)
        setSession((n) => n + 1)
      },
      updateProfile({ name, email }) {
        const key = normalize(email)
        if (key !== currentEmail && accounts.some((a) => a.email === key)) return 'That email is already used by another account.'
        setAccounts((all) => all.map((a) => (a.email === currentEmail ? { ...a, name: name.trim(), email: key } : a)))
        setCurrentEmail(key)
        return null
      },
      changePassword(current, next) {
        if (user.password !== current) return 'Your current password is incorrect.'
        patchUser({ password: next })
        return null
      },
      changePlan: (plan) => patchUser({ plan }),
      setPreference: (key, val) => patchUser({ preferences: { ...user.preferences, [key]: val } }),
    }
  }, [accounts, currentEmail, session])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
