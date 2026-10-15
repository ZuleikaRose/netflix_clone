import { useMemo, useState } from 'react'
import { LibraryContext } from './libraryContext.js'

// All user data lives in memory only — a page refresh resets it, by design.
const toggleIn = (setter) => (id) => setter((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))

export function LibraryProvider({ children }) {
  const [myList, setMyList] = useState([])
  const [favorites, setFavorites] = useState([])
  const [reminders, setReminders] = useState([])
  const [ratings, setRatings] = useState({})
  const [reviews, setReviews] = useState({})
  const [feedback, setFeedback] = useState([])
  const [issues, setIssues] = useState([])
  const [doNotSell, setDoNotSell] = useState(false)
  const [bestScores, setBestScores] = useState({})
  // Affiliate account for this session: null until the user applies
  const [affiliate, setAffiliate] = useState(null)

  const value = useMemo(() => ({
    myList,
    favorites,
    reminders,
    ratings,
    reviews,
    feedback,
    issues,
    doNotSell,
    bestScores,
    affiliate,
    toggleMyList: toggleIn(setMyList),
    toggleFavorite: toggleIn(setFavorites),
    toggleReminder: toggleIn(setReminders),
    rate: (id, stars) => setRatings((r) => ({ ...r, [id]: stars })),
    addReview: (id, review) => setReviews((r) => ({ ...r, [id]: [review, ...(r[id] ?? [])] })),
    addFeedback: (entry) => setFeedback((f) => [entry, ...f]),
    addIssue: (issue) => setIssues((all) => [issue, ...all]),
    setDoNotSell,
    // better: 'low' (fewest moves wins) or 'high' (most points wins)
    recordScore: (game, value, better) => setBestScores((s) => {
      const prev = s[game]
      const improved = prev === undefined || (better === 'low' ? value < prev : value > prev)
      return improved ? { ...s, [game]: value } : s
    }),
    joinAffiliate: (application) => setAffiliate({ ...application, clicks: 0, signups: 0 }),
    // Demo-only stand-in for real referral tracking
    recordReferral: (kind) => setAffiliate((a) => a && ({ ...a, clicks: a.clicks + 1, signups: a.signups + (kind === 'signup' ? 1 : 0) })),
  }), [myList, favorites, reminders, ratings, reviews, feedback, issues, doNotSell, bestScores, affiliate])

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
}
