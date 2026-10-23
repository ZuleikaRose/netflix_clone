import { useEffect, useState, useSyncExternalStore } from 'react'
import { fetchReviewReports, memoryReviewReports, resolveMemoryReview, resolveReviewRow, subscribeMemoryReports } from '../data/reviewReports.js'
import { getSupabase } from '../lib/supabaseConfig.js'
import { useAuth } from './authContext.js'
import { tr } from '../i18n/index.js'

const warn = (error) => {
  if (import.meta.env.DEV) console.warn('Supabase:', error)
}

// The support dashboard's reported reviews (status null = all) and resolve(reviewId, remove). With Supabase through
// the staff-only database functions; in memory, this session's reports of the sample reviews.
export function useReviewReports(status) {
  const { backend } = useAuth()
  const memory = useSyncExternalStore(subscribeMemoryReports, memoryReviewReports)
  const [loaded, setLoaded] = useState({ key: null, reports: null, failed: false })
  const [version, setVersion] = useState(0)
  const key = `${status}:${version}`

  useEffect(() => {
    if (backend !== 'supabase') return undefined
    let ignore = false
    getSupabase()
      .then((supabase) => fetchReviewReports(supabase, status))
      .then((reports) => { if (!ignore) setLoaded({ key, reports, failed: false }) })
      .catch((error) => {
        warn(error)
        if (!ignore) setLoaded({ key, reports: null, failed: true })
      })
    return () => { ignore = true }
  }, [backend, status, key])

  if (backend !== 'supabase') {
    return {
      reports: memory.reports.filter((r) => !status || r.status === status),
      failed: false,
      async resolve(reviewId, remove) {
        resolveMemoryReview(reviewId, remove)
        return null
      },
    }
  }

  const current = loaded.key === key ? loaded : null
  return {
    reports: current?.reports ?? null,
    failed: Boolean(current?.failed),
    // Resolves to an error message or null
    async resolve(reviewId, remove) {
      try {
        await resolveReviewRow(await getSupabase(), reviewId, remove)
      } catch (error) {
        warn(error)
        return tr('The review couldn’t be updated. Please try again.')
      }
      setVersion((v) => v + 1)
      return null
    },
  }
}
