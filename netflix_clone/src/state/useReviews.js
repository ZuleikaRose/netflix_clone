import { useEffect, useState, useSyncExternalStore } from 'react'
import { fetchReviews, postReview } from '../data/libraryApi.js'
import {
  addMemoryReport, fetchMyReportedReviews, memoryReviewReports, reportErrorMessage, sendReviewReport, subscribeMemoryReports,
} from '../data/reviewReports.js'
import { getSupabase } from '../lib/supabaseConfig.js'
import { useAuth } from './authContext.js'
import { useLibrary } from './libraryContext.js'

const warn = (error) => {
  if (import.meta.env.DEV) console.warn('Supabase:', error)
}

// Reviews shown on a title page, as { id, mine, reported, author, stars, text }, how to add one and how to report one.
// Supabase: every member's reviews from the database (authors come from review.author_name).
// In memory: this session's reviews followed by the sample reviews in catalog.js, minus any "staff" removed.
export function useReviews(title) {
  const { backend, user } = useAuth()
  const library = useLibrary()
  const titleId = title?.id
  const [saved, setSaved] = useState({ titleId: null, reviews: [] })
  const [reported, setReported] = useState(() => new Set())
  const memory = useSyncExternalStore(subscribeMemoryReports, memoryReviewReports)

  useEffect(() => {
    if (backend !== 'supabase' || !titleId) return
    let ignore = false
    getSupabase()
      .then((supabase) => Promise.all([fetchReviews(supabase, titleId, user.id), fetchMyReportedReviews(supabase)]))
      .then(([reviews, mine]) => {
        if (ignore) return
        setSaved({ titleId, reviews })
        setReported(mine)
      })
      .catch(warn)
    return () => { ignore = true }
  }, [backend, titleId, user.id])

  if (backend !== 'supabase') {
    const own = (library.reviews[titleId] ?? []).map((r, i) => ({ ...r, id: `own:${titleId}:${i}`, mine: true }))
    const samples = (title?.reviews ?? []).map((r, i) => ({ ...r, id: `sample:${titleId}:${i}`, mine: false }))
    const reportedIds = new Set(memory.reports.map((r) => r.reviewId))
    return {
      reviews: title ? [...own, ...samples].filter((r) => !memory.removed.has(r.id)).map((r) => ({ ...r, reported: reportedIds.has(r.id) })) : [],
      addReview: async (review) => library.addReview(title.id, review),
      async report(review, reason, details) {
        addMemoryReport({ reviewId: review.id, titleId, author: review.author, text: review.text, reason, details, reporter: user.name })
        return null
      },
    }
  }

  return {
    reviews: (saved.titleId === titleId ? saved.reviews : []).map((r) => ({ ...r, reported: reported.has(r.id) })),
    // Each resolves to an error message or null
    async addReview(review) {
      let row
      try {
        row = await postReview(await getSupabase(), user.id, titleId, review)
      } catch (error) {
        warn(error)
        return 'Your review couldn’t be posted. Please try again.'
      }
      setSaved((s) => ({ titleId, reviews: [{ ...review, id: row.id, mine: true }, ...(s.titleId === titleId ? s.reviews : [])] }))
      return null
    },
    async report(review, reason, details) {
      try {
        await sendReviewReport(await getSupabase(), review.id, reason, details)
      } catch (error) {
        warn(error)
        if (error?.code !== '23505') return reportErrorMessage(error)
      }
      setReported((ids) => new Set([...ids, review.id]))
      return null
    },
  }
}
