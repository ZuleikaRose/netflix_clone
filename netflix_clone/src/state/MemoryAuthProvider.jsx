import { useMemo, useState } from 'react'
import { defaultBilling } from '../data/billing.js'
import { findPlan } from '../data/plans.js'
import { MAX_PIN_ATTEMPTS, MAX_PROFILES, PIN_LOCKOUT_MINUTES, newProfileId, pinMessages, profileNameProblem } from '../data/profiles.js'
import { findPromotion } from '../data/promotions.js'
import { checkTotpCode, newTotpKey, totpUri } from '../data/totp.js'
import { AuthContext, defaultPreferences, demoAccount, normalizeEmail } from './authContext.js'

// Accounts in memory only: they vanish on refresh, which also signs the user out (there's nothing to restore from). Used when Supabase isn't configured (CI) and by the e2e suite.
// Never use this pattern with real credentials. Same interface as SupabaseAuthProvider: actions are async and
// resolve to an error message or null.

// A new demo password on every page load, short enough to type (it's shown on the sign-in screen and in Account so the
// demo user can change their password or confirm deleting the account); also used for reset-link tokens.
// getRandomValues also works on plain-HTTP origins (randomUUID needs a secure context, e.g. fails on a LAN IP).
const READABLE = 'abcdefghjkmnpqrstuvwxyz23456789'
const randomSecret = () => Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => READABLE[b % READABLE.length]).join('')

// Every account starts with one profile named after the member
const firstProfile = (name) => ({ id: newProfileId(), name: name.trim().slice(0, 30) || 'Me', avatar: 'blue', maturity: 'all', locked: false })
// The in-memory demo account is also the support team, so the support dashboard can be tried without a backend
const newDemoAccount = () => ({ ...demoAccount, isStaff: true, password: randomSecret(), preferences: defaultPreferences, billing: defaultBilling, profiles: [firstProfile(demoAccount.name)] })

export function MemoryAuthProvider({ children }) {
  const [accounts, setAccounts] = useState(() => [newDemoAccount()])
  const [currentEmail, setCurrentEmail] = useState(null)
  // Bumped on every sign-in/out so per-session stores (My List, ratings…) start fresh
  const [session, setSession] = useState(0)
  // Message for the sign-in screen after a signed-in action ends the session (e.g. deleting the account)
  const [notice, setNotice] = useState(null)
  // Password reset links handed out this session (token → email) and the account the open reset page is for
  const [resetLinks, setResetLinks] = useState({})
  const [resettingEmail, setResettingEmail] = useState(null)
  // Password accepted, waiting for the authenticator code: { email }
  const [secondStep, setSecondStep] = useState(null)
  // When this page signed in (the only device an in-memory account has)
  const [signedInAt, setSignedInAt] = useState(null)

  const value = useMemo(() => {
    const user = accounts.find((a) => a.email === currentEmail) ?? null
    const patchUser = (patch) => setAccounts((all) => all.map((a) => (a.email === currentEmail ? { ...a, ...patch } : a)))

    const startSession = (email) => {
      setCurrentEmail(email)
      setSession((n) => n + 1)
      setNotice(null)
      setSecondStep(null)
      setSignedInAt(new Date())
    }
    const wrongCode = 'That code isn’t right. Check your authenticator app and try again.'

    return {
      backend: 'memory',
      ready: true,
      user: user && { ...user, twoStep: Boolean(user.totpKey) },
      session,
      notice,
      secondStep,
      demoEmail: demoAccount.email,
      demoPassword: accounts.find((a) => a.email === demoAccount.email)?.password ?? null,
      // The library lives in LibraryProvider's state only
      libraryFor: null,
      async login(email, password) {
        const account = accounts.find((a) => a.email === normalizeEmail(email))
        if (!account || account.password !== password) return 'Incorrect email or password.'
        if (account.totpKey) setSecondStep({ email: account.email })
        else startSession(account.email)
        return null
      },
      // Two-step sign-in: the authenticator key is kept on the account (`totpKey`); a setup waiting for its first
      // code is `pendingTotp`
      async verifySecondStep(code) {
        const account = accounts.find((a) => a.email === secondStep?.email)
        if (!account) return 'Please sign in again.'
        if (!checkTotpCode(account.totpKey, code)) return wrongCode
        startSession(account.email)
        return null
      },
      async cancelSecondStep() {
        setSecondStep(null)
      },
      async startTwoStep() {
        const key = newTotpKey()
        patchUser({ pendingTotp: key })
        return { factorId: 'memory', key, uri: totpUri(key, user.email), qrCode: null }
      },
      async confirmTwoStep(factorId, code) {
        if (!user.pendingTotp || !checkTotpCode(user.pendingTotp, code)) return wrongCode
        patchUser({ totpKey: user.pendingTotp, pendingTotp: null })
        return null
      },
      async turnOffTwoStep(code) {
        if (user.totpKey && !checkTotpCode(user.totpKey, code)) return wrongCode
        patchUser({ totpKey: null })
        return null
      },
      // In memory the account is only ever signed in here
      async listDevices() {
        return { devices: [{ id: 'this-device', userAgent: navigator.userAgent, signedInAt, lastActiveAt: new Date(), current: true }] }
      },
      async signOutDevice() {
        return 'That device is already signed out.'
      },
      async signOutOtherDevices() {
        return null
      },
      async loginDemo() {
        // Recreate the demo account if it was deleted earlier in this session
        setAccounts((all) => (all.some((a) => a.email === demoAccount.email) ? all : [...all, newDemoAccount()]))
        // Two-step sign-in still asks for a code
        if (accounts.find((a) => a.email === demoAccount.email)?.totpKey) setSecondStep({ email: demoAccount.email })
        else startSession(demoAccount.email)
        return null
      },
      async signup({ name, email, password, plan }) {
        const key = normalizeEmail(email)
        if (accounts.some((a) => a.email === key)) return { error: 'An account with this email already exists.' }
        setAccounts((all) => [...all, { name: name.trim(), email: key, password, plan, preferences: defaultPreferences, billing: defaultBilling, profiles: [firstProfile(name)] }])
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
      // No email without a backend, so the reset link is handed back for the page to show. Every address gets a
      // link (it only works for an existing account), so the form doesn't reveal which accounts exist.
      async requestPasswordReset(email) {
        const token = randomSecret()
        setResetLinks((links) => ({ ...links, [token]: normalizeEmail(email) }))
        return { error: null, demoLink: `/reset-password?demo_token=${token}` }
      },
      // `link` is the page location; resolves to { email } or { error }
      async beginPasswordReset(link) {
        const email = resetLinks[new URLSearchParams(link.search).get('demo_token')]
        if (!email || !accounts.some((a) => a.email === email)) return { error: 'This reset link is invalid or has expired. Please request a new one.' }
        setResettingEmail(email)
        return { error: null, email }
      },
      async completePasswordReset(password) {
        if (!resettingEmail) return 'This reset link is invalid or has expired. Please request a new one.'
        setAccounts((all) => all.map((a) => (a.email === resettingEmail ? { ...a, password } : a)))
        // One use per link
        setResetLinks((links) => Object.fromEntries(Object.entries(links).filter(([, email]) => email !== resettingEmail)))
        setResettingEmail(null)
        setNotice('Your password has been changed. Sign in with your new password.')
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
      // Profiles: same rules as the database (unique names, at most five, at least one)
      async addProfile(profile) {
        if (user.profiles.length >= MAX_PROFILES) return `An account can have at most ${MAX_PROFILES} profiles.`
        const problem = profileNameProblem(profile.name, user.profiles)
        if (problem) return problem
        patchUser({ profiles: [...user.profiles, { ...profile, id: newProfileId(), name: profile.name.trim(), locked: false }] })
        return null
      },
      async editProfile(id, patch) {
        if (patch.name !== undefined) {
          const problem = profileNameProblem(patch.name, user.profiles.filter((p) => p.id !== id))
          if (problem) return problem
        }
        patchUser({ profiles: user.profiles.map((p) => (p.id === id ? { ...p, ...patch, name: (patch.name ?? p.name).trim() } : p)) })
        return null
      },
      async removeProfile(id) {
        if (user.profiles.length <= 1) return 'An account needs at least one profile.'
        patchUser({ profiles: user.profiles.filter((p) => p.id !== id) })
        return null
      },
      async checkPassword(password) {
        return user.password === password ? null : 'That password isn’t right.'
      },
      // PINs are kept on the account (`pins`: { [profileId]: { pin, failed, lockedUntil } }), like the database's
      // private.profile_pins
      async setProfilePin(id, pin, password) {
        if (user.password !== password) return 'Your password is incorrect.'
        const pins = { ...user.pins }
        if (pin === null) delete pins[id]
        else pins[id] = { pin, failed: 0, lockedUntil: 0 }
        patchUser({ pins, profiles: user.profiles.map((p) => (p.id === id ? { ...p, locked: pin !== null } : p)) })
        return null
      },
      async unlockProfile(id, pin) {
        const lock = user.pins?.[id]
        if (!lock) return null
        if (lock.lockedUntil > Date.now()) return pinMessages.locked
        if (lock.pin === pin) {
          patchUser({ pins: { ...user.pins, [id]: { ...lock, failed: 0, lockedUntil: 0 } } })
          return null
        }
        const failed = lock.failed + 1
        const lockedOut = failed >= MAX_PIN_ATTEMPTS
        patchUser({ pins: { ...user.pins, [id]: { ...lock, failed: lockedOut ? 0 : failed, lockedUntil: lockedOut ? Date.now() + PIN_LOCKOUT_MINUTES * 60_000 : 0 } } })
        return lockedOut ? pinMessages.locked : pinMessages.wrong
      },
      // Referral clicks are only simulated (Affiliate → Demo tools) without Supabase
      recordReferralClick() {},
    }
  }, [accounts, currentEmail, session, notice, resetLinks, resettingEmail, secondStep, signedInAt])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
