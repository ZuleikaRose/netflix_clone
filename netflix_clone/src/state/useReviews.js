import { useEffect, useState, useSyncExternalStore } from 'react'
import {
  addHelpfulVote, fetchMyHelpfulVotes, memoryHelpfulVotes, removeHelpfulVote, subscribeMemoryVotes, toggleMemoryVote,
  voteErrorMessage,
} from '../data/helpfulVotes.js'
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

// Reviews shown on a title page, newest first, as { id, mine, reported, author, stars, text, helpful, votedHelpful },
// how to add one, report one and mark one helpful (or take that back).
// Supabase: every member's reviews from the database (authors come from review.author_name, counts from
// review.helpful_count). In memory: this session's reviews followed by the sample reviews in catalog.js, minus any
// "staff" removed, with this session's votes.
export function useReviews(title) {
  const { backend, user } = useAuth()
  const library = useLibrary()
  const titleId = title?.id
  const [saved, setSaved] = useState({ titleId: null, reviews: [] })
  const [reported, setReported] = useState(() => new Set())
  const [voted, setVoted] = useState(() => new Set())
  const memory = useSyncExternalStore(subscribeMemoryReports, memoryReviewReports)
  const memoryVotes = useSyncExternalStore(subscribeMemoryVotes, memoryHelpfulVotes)

  useEffect(() => {
    if (backend !== 'supabase' || !titleId) return
    let ignore = false
    getSupabase()
      .then(async (supabase) => {
        const reviews = await fetchReviews(supabase, titleId, user.id)
        const [mine, votes] = await Promise.all([
          fetchMyReportedReviews(supabase),
          fetchMyHelpfulVotes(supabase, reviews.filter((r) => !r.mine).map((r) => r.id)),
        ])
        if (ignore) return
        setSaved({ titleId, reviews })
        setReported(mine)
        setVoted(votes)
      })
      .catch(warn)
    return () => { ignore = true }
  }, [backend, titleId, user.id])

  if (backend !== 'supabase') {
    const own = (library.reviews[titleId] ?? []).map((r, i) => ({ ...r, id: `own:${titleId}:${i}`, mine: true }))
    const samples = (title?.reviews ?? []).map((r, i) => ({ ...r, id: `sample:${titleId}:${i}`, mine: false }))
    const reportedIds = new Set(memory.reports.map((r) => r.reviewId))
    return {
      reviews: title
        ? [...own, ...samples].filter((r) => !memory.removed.has(r.id)).map((r) => ({
          ...r, reported: reportedIds.has(r.id), votedHelpful: memoryVotes.has(r.id), helpful: memoryVotes.has(r.id) ? 1 : 0,
        }))
        : [],
      addReview: async (review) => library.addReview(title.id, review),
      async report(review, reason, details) {
        addMemoryReport({ reviewId: review.id, titleId, author: review.author, text: review.text, reason, details, reporter: user.name })
        return null
      },
      async toggleHelpful(review) {
        toggleMemoryVote(review.id)
        return null
      },
    }
  }

  return {
    reviews: (saved.titleId === titleId ? saved.reviews : [])
      .map((r) => ({ ...r, reported: reported.has(r.id), votedHelpful: voted.has(r.id) })),
    // Each resolves to an error message or null
    async addReview(review) {
      let row
      try {
        row = await postReview(await getSupabase(), user.id, titleId, review)
      } catch (error) {
        warn(error)
        return 'Your review couldn’t be posted. Please try again.'
      }
      setSaved((s) => ({ titleId, reviews: [{ ...review, id: row.id, mine: true, helpful: 0 }, ...(s.titleId === titleId ? s.reviews : [])] }))
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
    async toggleHelpful(review) {
      const adding = !voted.has(review.id)
      // False when the vote was already there (cast in another tab), so the count already includes it
      let changed = true
      try {
        const supabase = await getSupabase()
        await (adding ? addHelpfulVote(supabase, review.id) : removeHelpfulVote(supabase, review.id))
      } catch (error) {
        warn(error)
        if (error?.code !== '23505') return voteErrorMessage(error)
        changed = false
      }
      setVoted((ids) => {
        const next = new Set(ids)
        if (adding) next.add(review.id)
        else next.delete(review.id)
        return next
      })
      // The database keeps the real count; this mirrors the change until the next load
      if (changed) {
        const step = adding ? 1 : -1
        setSaved((s) => ({ ...s, reviews: s.reviews.map((r) => (r.id === review.id ? { ...r, helpful: Math.max(0, r.helpful + step) } : r)) }))
      }
      return null
    },
  }
}
