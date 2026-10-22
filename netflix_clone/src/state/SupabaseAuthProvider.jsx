import { useEffect, useMemo, useRef, useState } from 'react'
import { authErrorMessage, billingColumns, callFunction, codeErrorMessage, endDeviceSession, loadAccount, loadDevices, saveAccount, savePreference } from '../data/accountApi.js'
import { libraryApi } from '../data/libraryApi.js'
import { pinMessages } from '../data/profiles.js'
import { deleteProfileRow, insertProfile, profileErrorMessage, setProfilePinRow, setScreenTimeLimitRow, unlockProfileRow, updateProfileRow, verifyPassword } from '../data/profilesApi.js'
import { getSupabase, hasStoredSession, readStored, writeStored } from '../lib/supabaseConfig.js'
import { AuthContext, normalizeEmail } from './authContext.js'

// Supabase Auth. The session is saved in the browser (see lib/supabase.js) and restored on page load, so a reload keeps
// the member signed in; their account and library come back from the database. `ready` is false while that restore
// runs, so guarded routes wait instead of bouncing to /login.
// Same interface as MemoryAuthProvider: actions are async and resolve to an error message or null.

const warn = (error) => {
  if (import.meta.env.DEV) console.warn('Supabase:', error)
}

// A visitor opening /signup?ref=CODE counts as one click, even if React renders the page twice
const countedReferrals = new Set()

// This visitor's demo account { email, password, expiresAt }, kept so the password stays on screen after a reload
const DEMO_STORAGE_KEY = 'netflix-clone-demo'
function storedDemo() {
  const demo = readStored(DEMO_STORAGE_KEY)
  return demo?.email && demo?.password && Date.parse(demo.expiresAt) > Date.now() ? demo : null
}

export function SupabaseAuthProvider({ children }) {
  const [client, setClient] = useState(null)
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(0)
  const [notice, setNotice] = useState(null)
  // Signed in with the password, waiting for the authenticator code: { email }
  const [secondStep, setSecondStep] = useState(null)
  const [demo, setDemo] = useState(storedDemo)
  // Nothing to restore without a stored session, so the app is ready at once
  const [ready, setReady] = useState(() => !hasStoredSession())
  const listening = useRef(false)
  const restoring = useRef(false)

  useEffect(() => writeStored(DEMO_STORAGE_KEY, demo), [demo])

  // Rebuilt only when the signed-in user changes, not on every profile edit. LibraryProvider asks for the active
  // profile's library: libraryFor(profileId)
  const userId = user?.id
  const libraryFor = useMemo(() => (client && userId ? (profileId) => libraryApi(client, userId, profileId) : null), [client, userId])

  const value = useMemo(() => {
    const connect = async () => {
      const supabase = await getSupabase()
      setClient(supabase)
      if (!listening.current) {
        listening.current = true
        // E.g. the refresh token was revoked (account access removed elsewhere)
        supabase.auth.onAuthStateChange((event) => {
          if (event === 'SIGNED_OUT') setUser(null)
        })
      }
      return supabase
    }

    // Resolves to an error message or null. If the account can't be loaded, the half-made session is signed out.
    const startSession = async (supabase, authUser) => {
      try {
        setUser(await loadAccount(supabase, authUser))
      } catch (error) {
        warn(error)
        await supabase.auth.signOut({ scope: 'local' }).catch(warn)
        return 'You’re signed in, but your account couldn’t be loaded. Please try again.'
      }
      setSession((n) => n + 1)
      setNotice(null)
      setSecondStep(null)
      return null
    }

    // With two-step sign-in on, a password sign-in (or a restored session) is only aal1 until a code is entered: wait
    // for it instead of loading the account, which the database wouldn't show yet anyway
    const needsSecondStep = async (supabase) => {
      const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (error) throw error
      return data.nextLevel === 'aal2' && data.currentLevel !== 'aal2'
    }
    const verifiedFactor = async (supabase) => {
      const { data, error } = await supabase.auth.mfa.listFactors()
      if (error) throw error
      return data.totp.find((f) => f.status === 'verified') ?? null
    }

    const signIn = async (email, password) => {
      try {
        const supabase = await connect()
        const { data, error } = await supabase.auth.signInWithPassword({ email: normalizeEmail(email), password })
        if (error) return authErrorMessage(error)
        if (await needsSecondStep(supabase)) {
          setSecondStep({ email: data.user.email })
          return null
        }
        return startSession(supabase, data.user)
      } catch (error) {
        warn(error)
        return 'We couldn’t sign you in. Check your connection and try again.'
      }
    }

    const endSession = () => {
      setUser(null)
      setSession((n) => n + 1)
    }

    // Shows the change at once and puts it back if saving fails
    const saveOptimistically = async (patch, save) => {
      const before = user
      setUser((u) => ({ ...u, ...patch }))
      try {
        await save(client)
      } catch (error) {
        warn(error)
        setUser(before)
      }
    }

    // Page load with a saved session: sign the member back in. A session that can't be used (expired, revoked, or
    // the account can't be loaded) is cleared, and they see the sign-in page.
    const restoreSession = async () => {
      try {
        const supabase = await connect()
        const { data, error } = await supabase.auth.getSession()
        if (error) throw error
        if (data.session && (await needsSecondStep(supabase))) setSecondStep({ email: data.session.user.email })
        else if (data.session) await startSession(supabase, data.session.user)
      } catch (error) {
        warn(error)
      } finally {
        setReady(true)
      }
    }

    return {
      backend: 'supabase',
      ready,
      restoreSession,
      user,
      session,
      notice,
      demoEmail: demo?.email ?? null,
      demoPassword: demo?.password ?? null,
      libraryFor,
      secondStep,
      login: signIn,
      // The second step of signing in: the six-digit code from the member's authenticator app
      async verifySecondStep(code) {
        try {
          const factor = await verifiedFactor(client)
          if (!factor) return 'Two-step sign-in isn’t set up for this account. Please sign in again.'
          const { error } = await client.auth.mfa.challengeAndVerify({ factorId: factor.id, code })
          if (error) return codeErrorMessage(error)
          const { data, error: userError } = await client.auth.getUser()
          if (userError) throw userError
          return startSession(client, data.user)
        } catch (error) {
          warn(error)
          return 'We couldn’t check the code. Check your connection and try again.'
        }
      },
      async cancelSecondStep() {
        await client?.auth.signOut({ scope: 'local' }).catch(warn)
        setSecondStep(null)
      },
      // Turning two-step sign-in on: a new authenticator factor to scan, then confirmTwoStep with its first code.
      // Resolves to { factorId, key, uri, qrCode } or { error }.
      async startTwoStep() {
        try {
          // A setup that was never confirmed would block a new one with the same name
          const { data: factors, error: listError } = await client.auth.mfa.listFactors()
          if (listError) throw listError
          for (const f of factors.all.filter((f) => f.factor_type === 'totp' && f.status !== 'verified')) {
            await client.auth.mfa.unenroll({ factorId: f.id })
          }
          const { data, error } = await client.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Authenticator ${new Date().toISOString()}` })
          if (error) throw error
          // Auth sends the QR code as an SVG data URL (older versions sent the bare SVG)
          const qr = data.totp.qr_code
          return { factorId: data.id, key: data.totp.secret, uri: data.totp.uri, qrCode: qr.startsWith('data:') ? qr : `data:image/svg+xml;utf-8,${encodeURIComponent(qr)}` }
        } catch (error) {
          warn(error)
          return { error: 'Two-step sign-in couldn’t be set up. Please try again.' }
        }
      },
      async confirmTwoStep(factorId, code) {
        try {
          const { error } = await client.auth.mfa.challengeAndVerify({ factorId, code })
          if (error) return codeErrorMessage(error)
        } catch (error) {
          warn(error)
          return 'We couldn’t check the code. Check your connection and try again.'
        }
        setUser((u) => ({ ...u, twoStep: true }))
        return null
      },
      // Needs a current code, so a session left open somewhere can't turn it off
      async turnOffTwoStep(code) {
        try {
          const factor = await verifiedFactor(client)
          if (factor) {
            const { error } = await client.auth.mfa.challengeAndVerify({ factorId: factor.id, code })
            if (error) return codeErrorMessage(error)
            const { error: removeError } = await client.auth.mfa.unenroll({ factorId: factor.id })
            if (removeError) throw removeError
          }
        } catch (error) {
          warn(error)
          return 'Two-step sign-in couldn’t be turned off. Please try again.'
        }
        setUser((u) => ({ ...u, twoStep: false }))
        return null
      },
      // Signed-in devices: { devices } or { error }
      async listDevices() {
        try {
          return { devices: await loadDevices(client) }
        } catch (error) {
          warn(error)
          return { error: 'Your devices couldn’t be loaded. Please try again.' }
        }
      },
      async signOutDevice(id) {
        try {
          return (await endDeviceSession(client, id)) ? null : 'That device is already signed out.'
        } catch (error) {
          warn(error)
          return 'That device couldn’t be signed out. Please try again.'
        }
      },
      async signOutOtherDevices() {
        try {
          const { error } = await client.auth.signOut({ scope: 'others' })
          if (!error) return null
          warn(error)
        } catch (error) {
          // e.g. offline
          warn(error)
        }
        return 'Your other devices couldn’t be signed out. Please try again.'
      },
      async loginDemo() {
        // Reuse this visitor's demo account; make a new one the first time (or once it has expired or been deleted)
        if (demo && !(await signIn(demo.email, demo.password))) return null
        try {
          const { data, error } = await callFunction(await connect(), 'demo-account')
          if (error) return error
          setDemo({ email: data.email, password: data.password, expiresAt: data.expiresAt })
          return signIn(data.email, data.password)
        } catch (error) {
          warn(error)
          return 'The demo account couldn’t be created. Check your connection and try again.'
        }
      },
      async signup({ name, email, password, plan, referralCode }) {
        try {
          const supabase = await connect()
          const { data, error } = await supabase.auth.signUp({
            email: normalizeEmail(email),
            password,
            // Read by the sign-up trigger: account name, plan and the affiliate who referred them
            options: { data: { name: name.trim(), plan, referral_code: referralCode || undefined } },
          })
          if (error) return { error: authErrorMessage(error) }
          // With email confirmation on, an existing address comes back as a user without identities
          if (data.user && !data.user.identities?.length) return { error: 'An account with this email already exists.' }
          if (!data.session) return { error: null, confirmEmail: normalizeEmail(email) }
          return { error: await startSession(supabase, data.user) }
        } catch (error) {
          warn(error)
          return { error: 'We couldn’t create your account. Check your connection and try again.' }
        }
      },
      async logout() {
        await client?.auth.signOut({ scope: 'local' }).catch(warn)
        endSession()
      },
      async deleteAccount(password) {
        if (user?.billing.status !== 'cancelled') return 'Cancel your membership before deleting your account.'
        const { error } = await callFunction(client, 'delete-account', { password })
        if (error) return error
        await client.auth.signOut({ scope: 'local' }).catch(warn)
        if (user.isDemo) setDemo(null)
        endSession()
        setNotice('Your account access has been deleted. To have your data removed, contact support.')
        return null
      },
      async updateProfile({ name, email }) {
        const key = normalizeEmail(email)
        try {
          if (name.trim() !== user.name) await saveAccount(client, user.id, { name: name.trim() })
          if (key !== user.email) {
            const { data, error } = await client.auth.updateUser({ email: key })
            if (error) return error.code === 'email_exists' ? 'That email is already used by another account.' : authErrorMessage(error)
            // With secure email change on, the new address only applies once confirmed
            if (data.user.email !== key) {
              setUser((u) => ({ ...u, name: name.trim() }))
              return `Check ${key} for a link to confirm the new address.`
            }
          }
        } catch (error) {
          warn(error)
          return 'Your profile couldn’t be saved. Please try again.'
        }
        setUser((u) => ({ ...u, name: name.trim(), email: key }))
        return null
      },
      async changePassword(current, next) {
        try {
          // Checked by the database (verify_account_password), not by signing in again: a new sign-in would replace
          // this session, and with two-step sign-in on it would need a code again
          if (!(await verifyPassword(client, current))) return 'Your current password is incorrect.'
          const { error } = await client.auth.updateUser({ password: next })
          if (error) return authErrorMessage(error)
        } catch (error) {
          warn(error)
          return 'Your password couldn’t be changed. Check your connection and try again.'
        }
        if (user.isDemo) setDemo((d) => d && { ...d, password: next })
        return null
      },
      // Supabase emails a link to /reset-password. Same answer whether or not the account exists.
      async requestPasswordReset(email) {
        try {
          const supabase = await connect()
          const { error } = await supabase.auth.resetPasswordForEmail(normalizeEmail(email), {
            redirectTo: `${window.location.origin}/reset-password`,
          })
          return { error: error ? authErrorMessage(error) : null }
        } catch (error) {
          warn(error)
          return { error: 'We couldn’t send the email. Check your connection and try again.' }
        }
      },
      // The email link lands with a one-time recovery session in the URL hash (#access_token=…&type=recovery), or an
      // error such as an expired link. Resolves to { email } or { error }.
      async beginPasswordReset(link) {
        const params = new URLSearchParams(link.hash.replace(/^#/, ''))
        if (params.get('error_code') === 'otp_expired') return { error: 'This reset link has expired. Please request a new one.' }
        const accessToken = params.get('access_token')
        const refreshToken = params.get('refresh_token')
        if (params.get('error') || params.get('type') !== 'recovery' || !accessToken || !refreshToken) {
          return { error: 'This reset link is invalid or has expired. Please request a new one.' }
        }
        try {
          const supabase = await connect()
          const { data, error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
          if (error) return { error: 'This reset link is invalid or has expired. Please request a new one.' }
          return { error: null, email: data.user.email }
        } catch (error) {
          warn(error)
          return { error: 'We couldn’t check your reset link. Check your connection and try again.' }
        }
      },
      async completePasswordReset(password) {
        try {
          const { error } = await client.auth.updateUser({ password })
          if (error) return authErrorMessage(error)
          // The recovery session was only for this; the member signs in again with the new password
          await client.auth.signOut({ scope: 'local' }).catch(warn)
        } catch (error) {
          warn(error)
          return 'Your password couldn’t be changed. Check your connection and try again.'
        }
        endSession()
        setNotice('Your password has been changed. Sign in with your new password.')
        return null
      },
      changePlan: (plan) => saveOptimistically({ plan }, (sb) => saveAccount(sb, user.id, { plan })),
      async applyPromo(code) {
        const { data, error } = await callFunction(client, 'apply-promo', { code })
        if (error) return error
        setUser((u) => ({ ...u, promo: data.promo.code }))
        return null
      },
      async removePromo() {
        const { error } = await callFunction(client, 'apply-promo', { remove: true })
        if (error) return warn(error)
        setUser((u) => ({ ...u, promo: null }))
      },
      updateBilling: (patch) => saveOptimistically(
        { billing: { ...user.billing, ...patch } },
        (sb) => saveAccount(sb, user.id, billingColumns(patch)),
      ),
      setPreference: (key, val) => saveOptimistically(
        { preferences: { ...user.preferences, [key]: val } },
        (sb) => savePreference(sb, user.id, key, val),
      ),
      // Profiles resolve to an error message or null; the database enforces unique names and one to five profiles
      async addProfile(profile) {
        try {
          const created = await insertProfile(client, user.id, profile)
          setUser((u) => ({ ...u, profiles: [...u.profiles, created] }))
          return null
        } catch (error) {
          warn(error)
          return profileErrorMessage(error)
        }
      },
      async editProfile(id, patch) {
        try {
          await updateProfileRow(client, user.id, id, patch)
        } catch (error) {
          warn(error)
          return profileErrorMessage(error)
        }
        setUser((u) => ({ ...u, profiles: u.profiles.map((p) => (p.id === id ? { ...p, ...patch, name: (patch.name ?? p.name).trim() } : p)) }))
        return null
      },
      async removeProfile(id) {
        try {
          await deleteProfileRow(client, user.id, id)
        } catch (error) {
          warn(error)
          return profileErrorMessage(error)
        }
        setUser((u) => ({ ...u, profiles: u.profiles.filter((p) => p.id !== id) }))
        return null
      },
      // Kids profiles ask for the account password ("Ask a grown-up"); resolves to an error message or null
      async checkPassword(password) {
        try {
          return (await verifyPassword(client, password)) ? null : 'That password isn’t right.'
        } catch (error) {
          warn(error)
          return error?.code === 'P0001' ? error.message : 'Your password couldn’t be checked. Please try again.'
        }
      },
      // A profile's PIN (four digits), or null to remove it; needs the account password
      async setProfilePin(id, pin, password) {
        try {
          await setProfilePinRow(client, id, pin, password)
        } catch (error) {
          warn(error)
          return profileErrorMessage(error)
        }
        setUser((u) => ({ ...u, profiles: u.profiles.map((p) => (p.id === id ? { ...p, locked: pin !== null } : p)) }))
        return null
      },
      // A profile's daily screen-time limit in minutes, or null to remove it; needs the account password
      async setScreenTimeLimit(id, minutes, password) {
        try {
          await setScreenTimeLimitRow(client, id, minutes, password)
        } catch (error) {
          warn(error)
          return profileErrorMessage(error)
        }
        setUser((u) => ({ ...u, profiles: u.profiles.map((p) => (p.id === id ? { ...p, dailyLimit: minutes } : p)) }))
        return null
      },
      async unlockProfile(id, pin) {
        try {
          const result = await unlockProfileRow(client, id, pin)
          return result === 'ok' ? null : pinMessages[result]
        } catch (error) {
          warn(error)
          return 'The PIN couldn’t be checked. Please try again.'
        }
      },
      async recordReferralClick(code) {
        if (!code || countedReferrals.has(code)) return
        countedReferrals.add(code)
        try {
          const { error } = await callFunction(await getSupabase(), 'record-referral', { code })
          if (error) warn(error)
        } catch (error) {
          // Loading the client failed (e.g. offline); a missed click count isn't worth bothering the visitor about
          warn(error)
        }
      },
    }
  }, [client, user, session, notice, demo, libraryFor, ready, secondStep])

  const { restoreSession } = value
  useEffect(() => {
    // Once per page load (React runs effects twice in development)
    if (ready || restoring.current) return
    restoring.current = true
    restoreSession()
  }, [ready, restoreSession])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
