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

  const value = useMemo(() => ({
    myList,
    favorites,
    reminders,
    ratings,
    reviews,
    toggleMyList: toggleIn(setMyList),
    toggleFavorite: toggleIn(setFavorites),
    toggleReminder: toggleIn(setReminders),
    rate: (id, stars) => setRatings((r) => ({ ...r, [id]: stars })),
    addReview: (id, review) => setReviews((r) => ({ ...r, [id]: [review, ...(r[id] ?? [])] })),
  }), [myList, favorites, reminders, ratings, reviews])

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
}
