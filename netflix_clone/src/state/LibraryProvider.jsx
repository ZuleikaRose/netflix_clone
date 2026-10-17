import { useEffect, useMemo, useState } from 'react'
import { useAuth } from './authContext.js'
import { LibraryContext } from './libraryContext.js'

// The signed-in user's lists, ratings, scores and reports. Changes show at once; with Supabase (`library` from the
// auth context) they are also saved and loaded back on the next sign-in. Without it everything stays in memory and a
// refresh resets it, as before. Keyed by the auth session, so each sign-in starts from that user's data.

const warn = (error) => {
  if (import.meta.env.DEV) console.warn('Supabase:', error)
}

const toggleIn = (setter) => (id) => setter((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))

export function LibraryProvider({ children }) {
  const { library: remote } = useAuth()
  const [myList, setMyList] = useState([])
  const [favorites, setFavorites] = useState([])
  const [reminders, setReminders] = useState([])
  const [ratings, setRatings] = useState({})
  // Reviews posted this session (in-memory backend only; with Supabase, useReviews reads them from the database)
  const [reviews, setReviews] = useState({})
  const [feedback, setFeedback] = useState([])
  const [issues, setIssues] = useState([])
  const [doNotSell, setDoNotSell] = useState(false)
  const [bestScores, setBestScores] = useState({})
  // Affiliate account: null until the user applies
  const [affiliate, setAffiliate] = useState(null)
  const [dismissedNotices, setDismissedNotices] = useState([])

  useEffect(() => {
    if (!remote) return
    let ignore = false
    remote.load().then((saved) => {
      if (ignore) return
      setMyList(saved.myList)
      setFavorites(saved.favorites)
      setReminders(saved.reminders)
      setRatings(saved.ratings)
      setFeedback(saved.feedback)
      setIssues(saved.issues)
      setDoNotSell(saved.doNotSell)
      setBestScores(saved.bestScores)
      setAffiliate(saved.affiliate)
    }).catch(warn)
    return () => { ignore = true }
  }, [remote])

  const value = useMemo(() => {
    const save = (promise) => promise?.catch(warn)
    // Add or remove a title id, locally and (with Supabase) in its table
    const toggleSaved = (ids, setter, table) => (id) => {
      toggleIn(setter)(id)
      if (remote) save(ids.includes(id) ? remote[table].remove(id) : remote[table].add(id))
    }

    return {
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
      dismissedNotices,
      // Sign-ups only arrive through a real referral link when the database tracks them
      canSimulateSignups: !remote,
      toggleMyList: toggleSaved(myList, setMyList, 'myList'),
      toggleFavorite: toggleSaved(favorites, setFavorites, 'favorites'),
      toggleReminder: toggleSaved(reminders, setReminders, 'reminders'),
      rate: (id, stars) => {
        setRatings((r) => ({ ...r, [id]: stars }))
        save(remote?.rate(id, stars))
      },
      addReview: (id, review) => setReviews((r) => ({ ...r, [id]: [review, ...(r[id] ?? [])] })),
      addFeedback: (entry) => {
        setFeedback((f) => [entry, ...f])
        save(remote?.addFeedback(entry))
      },
      // Resolves to the filed issue, with its ticket number
      async addIssue(issue) {
        const filed = remote ? await remote.addIssue(issue) : { ...issue, id: `NF-${48210 + issues.length}` }
        setIssues((all) => [filed, ...all])
        return filed
      },
      setDoNotSell: (on) => {
        setDoNotSell(on)
        save(remote?.setDoNotSell(on))
      },
      // better: 'low' (fewest moves wins) or 'high' (most points wins)
      recordScore: (game, score, better) => {
        const prev = bestScores[game]
        if (prev !== undefined && (better === 'low' ? score >= prev : score <= prev)) return
        setBestScores((s) => ({ ...s, [game]: score }))
        save(remote?.saveScore(game, score))
      },
      dismissNotice: (id) => setDismissedNotices((ids) => [...ids, id]),
      async joinAffiliate(application) {
        if (!remote) return setAffiliate({ ...application, clicks: 0, signups: 0 })
        await remote.joinAffiliate(application).then(setAffiliate, warn)
      },
      // Demo tools: a click goes through the real tracking endpoint when the database is connected
      async recordReferral(kind) {
        if (!remote) {
          setAffiliate((a) => a && ({ ...a, clicks: a.clicks + 1, signups: a.signups + (kind === 'signup' ? 1 : 0) }))
          return
        }
        if (kind === 'click') await remote.recordClick(affiliate.code).then(setAffiliate, warn)
      },
    }
  }, [remote, myList, favorites, reminders, ratings, reviews, feedback, issues, doNotSell, bestScores, affiliate, dismissedNotices])

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
}
