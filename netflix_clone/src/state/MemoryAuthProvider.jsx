import { useMemo, useState } from 'react'
import { defaultBilling } from '../data/billing.js'
import { findPlan } from '../data/plans.js'
import { findPromotion } from '../data/promotions.js'
import { AuthContext, defaultPreferences, demoAccount, normalizeEmail } from './authContext.js'

// Accounts in memory only: they vanish on refresh. Used when Supabase isn't configured (CI) and by the e2e suite.
// Never use this pattern with real credentials. Same interface as SupabaseAuthProvider: actions are async and
// resolve to an error message or null.

// A new demo password on every page load, short enough to type (it's shown on the sign-in screen and in Account so the
// demo user can change their password or confirm deleting the account). getRandomValues also works on plain-HTTP
// origins (randomUUID needs a secure context, e.g. fails on a LAN IP).
const READABLE = 'abcdefghjkmnpqrstuvwxyz23456789'
const randomSecret = () => Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => READABLE[b % READABLE.length]).join('')

const newDemoAccount = () => ({ ...demoAccount, password: randomSecret(), preferences: defaultPreferences, billing: defaultBilling })

export function MemoryAuthProvider({ children }) {
  const [accounts, setAccounts] = useState(() => [newDemoAccount()])
  const [currentEmail, setCurrentEmail] = useState(null)
  // Bumped on every sign-in/out so per-session stores (My List, ratings…) start fresh
  const [session, setSession] = useState(0)
  // Message for the sign-in screen after a signed-in action ends the session (e.g. deleting the account)
  const [notice, setNotice] = useState(null)

  const value = useMemo(() => {
    const user = accounts.find((a) => a.email === currentEmail) ?? null
    const patchUser = (patch) => setAccounts((all) => all.map((a) => (a.email === currentEmail ? { ...a, ...patch } : a)))

    const startSession = (email) => {
      setCurrentEmail(email)
      setSession((n) => n + 1)
      setNotice(null)
    }

    return {
      backend: 'memory',
      user,
      session,
      notice,
      demoEmail: demoAccount.email,
      demoPassword: accounts.find((a) => a.email === demoAccount.email)?.password ?? null,
      // The library lives in LibraryProvider's state only
      library: null,
      async login(email, password) {
        const account = accounts.find((a) => a.email === normalizeEmail(email))
        if (!account || account.password !== password) return 'Incorrect email or password.'
        startSession(account.email)
        return null
      },
      async loginDemo() {
        // Recreate the demo account if it was deleted earlier in this session
        setAccounts((all) => (all.some((a) => a.email === demoAccount.email) ? all : [...all, newDemoAccount()]))
        startSession(demoAccount.email)
        return null
      },
      async signup({ name, email, password, plan }) {
        const key = normalizeEmail(email)
        if (accounts.some((a) => a.email === key)) return { error: 'An account with this email already exists.' }
        setAccounts((all) => [...all, { name: name.trim(), email: key, password, plan, preferences: defaultPreferences, billing: defaultBilling }])
        startSession(key)
        return { error: null }
      },
      async logout() {
        setCurrentEmail(null)
        setSession((n) => n + 1)
      },
      // Removes sign-in access only; asking support to erase the account's data is a separate request
      async deleteAccount(password) {
        if (user?.billing.status !== 'cancelled') return 'Cancel your membership before deleting your account.'
        if (user.password !== password) return 'Your password is incorrect.'
        setAccounts((all) => all.filter((a) => a.email !== currentEmail))
        setCurrentEmail(null)
        setSession((n) => n + 1)
        setNotice('Your account access has been deleted. To have your data removed, contact support.')
        return null
      },
      async updateProfile({ name, email }) {
        const key = normalizeEmail(email)
        if (key !== currentEmail && accounts.some((a) => a.email === key)) return 'That email is already used by another account.'
        setAccounts((all) => all.map((a) => (a.email === currentEmail ? { ...a, name: name.trim(), email: key } : a)))
        setCurrentEmail(key)
        return null
      },
      async changePassword(current, next) {
        if (user.password !== current) return 'Your current password is incorrect.'
        patchUser({ password: next })
        return null
      },
      async changePlan(plan) {
        patchUser({ plan })
      },
      async applyPromo(code) {
        const promo = findPromotion(code)
        if (!promo) return 'That code isn’t valid. Check the spelling and try again.'
        if (promo.plan && promo.plan !== user.plan) return `${promo.code} only works with the ${findPlan(promo.plan).name} plan.`
        patchUser({ promo: promo.code })
        return null
      },
      async removePromo() {
        patchUser({ promo: null })
      },
      async updateBilling(patch) {
        patchUser({ billing: { ...user.billing, ...patch } })
      },
      async setPreference(key, val) {
        patchUser({ preferences: { ...user.preferences, [key]: val } })
      },
      // Referral clicks are only simulated (Affiliate → Demo tools) without Supabase
      recordReferralClick() {},
    }
  }, [accounts, currentEmail, session, notice])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
