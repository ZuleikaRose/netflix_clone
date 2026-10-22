import { useEffect, useState } from 'react'
import { callFunction } from '../data/accountApi.js'
import { NETWORK_MESSAGE, RECHECK_AFTER_MS, loadMonthlyDonation } from '../data/donations.js'
import { getSupabase } from '../lib/supabaseConfig.js'
import { useAuth } from './authContext.js'

const warn = (error) => {
  if (import.meta.env.DEV) console.warn('Supabase:', error)
}

// The member's running monthly donation ({ monthly, loaded, cancel }); monthly is null when there's none. Only with
// Supabase (the in-memory build has no donations). `refreshKey` changes after a donation goes through: the webhook
// makes the new monthly donation active a moment later, so it looks again a few times.
export function useMonthlyDonation(refreshKey = 0) {
  const { backend } = useAuth()
  const [state, setState] = useState({ monthly: null, loaded: false })
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (backend !== 'supabase') return undefined
    let ignore = false
    const refresh = () => getSupabase().then(loadMonthlyDonation).then(
      (monthly) => { if (!ignore) setState({ monthly, loaded: true }) },
      (error) => {
        warn(error)
        // Shown as "no monthly donation"; the history and the function still guard against a second one
        if (!ignore) setState((s) => ({ ...s, loaded: true }))
      },
    )
    refresh()
    const timers = refreshKey ? RECHECK_AFTER_MS.map((ms) => setTimeout(refresh, ms)) : []
    return () => { ignore = true; timers.forEach(clearTimeout) }
  }, [backend, refreshKey, version])

  // Resolves to an error message or null
  const cancel = async () => {
    try {
      const { error, network } = await callFunction(await getSupabase(), 'monthly-donation', { action: 'cancel' })
      if (network) return NETWORK_MESSAGE
      if (error) return error
    } catch (error) {
      warn(error)
      return NETWORK_MESSAGE
    }
    setState((s) => ({ ...s, monthly: null }))
    setVersion((v) => v + 1)
    return null
  }

  return { ...state, cancel }
}
