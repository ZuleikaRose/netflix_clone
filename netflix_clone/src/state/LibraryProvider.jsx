import { useEffect, useMemo, useState } from 'react'
import { catalog } from '../data/catalog.js'
import { useAuth } from './authContext.js'
import { FINISHED_PERCENT, LibraryContext } from './libraryContext.js'

// The signed-in user's lists, ratings, scores and reports. Changes show at once; with Supabase (`library` from the
// auth context) they are also saved and loaded back at sign-in, including the automatic sign-in after a reload. Without
// it everything stays in memory and a refresh resets it. Keyed by the auth session, so each sign-in starts from that
// user's data.

const warn = (error) => {
  if (import.meta.env.DEV) console.warn('Supabase:', error)
}

// In memory, Continue Watching starts from the built-in catalog's sample progress; members start from their own rows
const sampleProgress = () => Object.fromEntries(catalog.filter((t) => t.progress).map((t) => [t.id, { percent: t.progress, episode: 1, seconds: null }]))

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
  // { [titleId]: { percent, episode, seconds } }: where the user stopped (seconds is null for the samples)
  const [progress, setProgress] = useState(() => (remote ? {} : sampleProgress()))

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
      setProgress(saved.progress)
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
      progress,
      // With the database, clicks and sign-ups are tracked for real (record-referral, sign-up trigger)
      canSimulateReferrals: !remote,
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
      // Called by the player as the user watches; finishing a title takes it out of Continue Watching
      saveProgress: (titleId, entry) => {
        const finished = entry.percent >= FINISHED_PERCENT
        // Newest first, so Continue Watching lists the latest title first
        setProgress((all) => {
          const others = Object.fromEntries(Object.entries(all).filter(([id]) => id !== titleId))
          return finished ? others : { [titleId]: entry, ...others }
        })
        if (remote) save(finished ? remote.clearProgress(titleId) : remote.saveProgress(titleId, entry))
      },
      dismissNotice: (id) => setDismissedNotices((ids) => [...ids, id]),
      async joinAffiliate(application) {
        if (!remote) return setAffiliate({ ...application, clicks: 0, signups: 0 })
        await remote.joinAffiliate(application).then(setAffiliate, warn)
      },
      // Demo tools (in-memory only): stand-ins for real referral tracking
      recordReferral: (kind) => {
        if (remote) return
        setAffiliate((a) => a && ({ ...a, clicks: a.clicks + 1, signups: a.signups + (kind === 'signup' ? 1 : 0) }))
      },
    }
  }, [remote, myList, favorites, reminders, ratings, reviews, feedback, issues, doNotSell, bestScores, affiliate, dismissedNotices, progress])

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
}
