import { useMemo, useRef, useState } from 'react'
import { authErrorMessage, billingColumns, callFunction, loadAccount, saveAccount, savePreference } from '../data/accountApi.js'
import { libraryApi } from '../data/libraryApi.js'
import { getSupabase } from '../lib/supabaseConfig.js'
import { AuthContext, normalizeEmail } from './authContext.js'

// Supabase Auth. The session is kept in memory only (see lib/supabase.js), so a reload still signs the user out, but
// the account and library are saved in the database and come back on the next sign-in.
// Same interface as MemoryAuthProvider: actions are async and resolve to an error message or null.

const warn = (error) => {
  if (import.meta.env.DEV) console.warn('Supabase:', error)
}

// A visitor opening /signup?ref=CODE counts as one click, even if React renders the page twice
const countedReferrals = new Set()

export function SupabaseAuthProvider({ children }) {
  const [client, setClient] = useState(null)
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(0)
  const [notice, setNotice] = useState(null)
  // The demo account created for this visitor on this page load: { email, password }
  const [demo, setDemo] = useState(null)
  const listening = useRef(false)

  // Rebuilt only when the signed-in user changes, not on every profile edit
  const userId = user?.id
  const library = useMemo(() => (client && userId ? libraryApi(client, userId) : null), [client, userId])

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
      return null
    }

    const signIn = async (email, password) => {
      try {
        const supabase = await connect()
        const { data, error } = await supabase.auth.signInWithPassword({ email: normalizeEmail(email), password })
        if (error) return authErrorMessage(error)
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

    return {
      backend: 'supabase',
      user,
      session,
      notice,
      demoEmail: demo?.email ?? null,
      demoPassword: demo?.password ?? null,
      library,
      login: signIn,
      async loginDemo() {
        // Reuse this page load's demo account; make a new one the first time (or if it was deleted)
        if (demo && !(await signIn(demo.email, demo.password))) return null
        try {
          const { data, error } = await callFunction(await connect(), 'demo-account')
          if (error) return error
          setDemo({ email: data.email, password: data.password })
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
          // Signing in again is how Supabase checks a password; it keeps the same user signed in
          const { error: checkError } = await client.auth.signInWithPassword({ email: user.email, password: current })
          if (checkError) return checkError.code === 'invalid_credentials' ? 'Your current password is incorrect.' : authErrorMessage(checkError)
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
  }, [client, user, session, notice, demo, library])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
