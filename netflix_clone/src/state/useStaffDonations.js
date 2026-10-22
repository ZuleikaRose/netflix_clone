import { useEffect, useMemo, useState } from 'react'
import { fetchDonationMonths, fetchRecentDonations, monthlyTotals, sampleDonations } from '../data/staffDonations.js'
import { getSupabase } from '../lib/supabaseConfig.js'
import { useAuth } from './authContext.js'

const warn = (error) => {
  if (import.meta.env.DEV) console.warn('Supabase:', error)
}

// The support dashboard's Donations view: { months, donations, failed } (months and donations are null while
// loading). `status` narrows the list to 'succeeded' or 'failed' (null = all); the monthly totals always cover both.
export function useStaffDonations(status) {
  const { backend } = useAuth()
  const [loaded, setLoaded] = useState({ status: undefined, months: null, donations: null, failed: false })
  const samples = useMemo(() => (backend === 'supabase' ? null : sampleDonations()), [backend])

  useEffect(() => {
    if (backend !== 'supabase') return undefined
    let ignore = false
    getSupabase()
      .then((supabase) => Promise.all([fetchDonationMonths(supabase), fetchRecentDonations(supabase, status)]))
      .then(([months, donations]) => { if (!ignore) setLoaded({ status, months, donations, failed: false }) })
      .catch((error) => {
        warn(error)
        if (!ignore) setLoaded({ status, months: null, donations: null, failed: true })
      })
    return () => { ignore = true }
  }, [backend, status])

  if (samples) {
    return { months: monthlyTotals(samples), donations: samples.filter((d) => !status || d.status === status), failed: false }
  }
  if (loaded.status !== status) return { months: null, donations: null, failed: false }
  return { months: loaded.months, donations: loaded.donations, failed: loaded.failed }
}
