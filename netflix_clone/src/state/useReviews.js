import { useEffect, useState } from 'react'
import { fetchReviews, postReview } from '../data/libraryApi.js'
import { getSupabase } from '../lib/supabaseConfig.js'
import { useAuth } from './authContext.js'
import { useLibrary } from './libraryContext.js'

// Reviews shown on a title page, as { author, stars, text }, and how to add one.
// Supabase: every member's reviews from the database (authors come from review.author_name).
// In memory: this session's reviews followed by the sample reviews in catalog.js.
export function useReviews(title) {
  const { backend, user } = useAuth()
  const library = useLibrary()
  const titleId = title?.id
  const [saved, setSaved] = useState({ titleId: null, reviews: [] })

  useEffect(() => {
    if (backend !== 'supabase' || !titleId) return
    let ignore = false
    getSupabase()
      .then((supabase) => fetchReviews(supabase, titleId))
      .then((reviews) => { if (!ignore) setSaved({ titleId, reviews }) })
      .catch((error) => { if (import.meta.env.DEV) console.warn('Supabase:', error) })
    return () => { ignore = true }
  }, [backend, titleId])

  if (backend !== 'supabase') {
    return {
      reviews: title ? [...(library.reviews[title.id] ?? []), ...title.reviews] : [],
      addReview: async (review) => library.addReview(title.id, review),
    }
  }

  return {
    reviews: saved.titleId === titleId ? saved.reviews : [],
    // Resolves to an error message or null
    async addReview(review) {
      try {
        await postReview(await getSupabase(), user.id, titleId, review)
      } catch (error) {
        if (import.meta.env.DEV) console.warn('Supabase:', error)
        return 'Your review couldn’t be posted. Please try again.'
      }
      setSaved((s) => ({ titleId, reviews: [review, ...(s.titleId === titleId ? s.reviews : [])] }))
      return null
    },
  }
}
