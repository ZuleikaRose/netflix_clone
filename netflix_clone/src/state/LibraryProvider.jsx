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
  }), [myList, favorites, reminders, ratings, reviews, feedback, issues, doNotSell, bestScores])

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
}
