import { useEffect, useMemo, useRef, useState } from 'react'
import { catalog } from '../data/catalog.js'
import { localDay } from '../data/notifications.js'
import { useAuth } from './authContext.js'
import { FINISHED_PERCENT, LibraryContext } from './libraryContext.js'
import { useProfile } from './profileContext.js'

// The signed-in user's lists, ratings, scores and reports. Changes show at once; with Supabase (`library` from the
// auth context) they are also saved and loaded back at sign-in, including the automatic sign-in after a reload. Without
// it everything stays in memory and a refresh resets it. Keyed by the auth session, so each sign-in starts from that
// user's data. Lists, reminders, Continue Watching and game scores belong to the watching profile (RequireProfile
// remounts this provider when it changes); ratings, reviews, reports and the rest are the account's.

const warn = (error) => {
  if (import.meta.env.DEV) console.warn('Supabase:', error)
}

// In memory, Continue Watching starts from the built-in catalog's sample progress; members start from their own rows
const sampleProgress = () => Object.fromEntries(catalog.filter((t) => t.progress).map((t) => [t.id, { percent: t.progress, episode: 1, seconds: null }]))

// In memory a profile switch remounts this provider, so each profile's library (and the account's) is kept here for
// the rest of the session
const memoryStash = new Map()

const toggleIn = (setter) => (id) => setter((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))

export function LibraryProvider({ children }) {
  const { libraryFor, session, user } = useAuth()
  const keepHistory = user.preferences.keepHistory !== false
  const { profile } = useProfile()
  const remote = useMemo(() => libraryFor?.(profile.id) ?? null, [libraryFor, profile.id])
  const accountKey = String(session)
  const profileKey = `${session}:${profile.id}`
  const [kept] = useState(() => (remote ? {} : { ...memoryStash.get(accountKey), ...memoryStash.get(profileKey) }))
  const [myList, setMyList] = useState(kept.myList ?? [])
  const [favorites, setFavorites] = useState(kept.favorites ?? [])
  const [reminders, setReminders] = useState(kept.reminders ?? [])
  // { [titleId]: 'YYYY-MM-DD' }: when each reminded title (or a show's next episode) comes out, if known
  const [reminderDates, setReminderDates] = useState(kept.reminderDates ?? {})
  const [ratings, setRatings] = useState(kept.ratings ?? {})
  // Reviews posted this session (in-memory backend only; with Supabase, useReviews reads them from the database)
  const [reviews, setReviews] = useState(kept.reviews ?? {})
  const [feedback, setFeedback] = useState(kept.feedback ?? [])
  const [issues, setIssues] = useState(kept.issues ?? [])
  const [doNotSell, setDoNotSell] = useState(kept.doNotSell ?? false)
  const [bestScores, setBestScores] = useState(kept.bestScores ?? {})
  // Affiliate account: null until the user applies
  const [affiliate, setAffiliate] = useState(kept.affiliate ?? null)
  const [dismissedNotices, setDismissedNotices] = useState(kept.dismissedNotices ?? [])
  // { [titleId]: { percent, episode, seconds } }: where the profile stopped (seconds is null for the samples)
  const [progress, setProgress] = useState(() => (remote ? {} : kept.progress ?? sampleProgress()))
  // Viewing history in memory ({ id, titleId, episode, day, at }, newest first); with Supabase it's read when shown
  const [history, setHistory] = useState(kept.history ?? [])
  // With Supabase, each title/episode/day is written once per page load (the player saves every few seconds)
  const recorded = useRef(new Set())

  useEffect(() => {
    if (remote) return
    memoryStash.set(accountKey, { ratings, reviews, feedback, issues, doNotSell, affiliate, dismissedNotices })
    memoryStash.set(profileKey, { myList, favorites, reminders, reminderDates, bestScores, progress, history })
  }, [remote, accountKey, profileKey, myList, favorites, reminders, reminderDates, history, ratings, reviews, feedback, issues, doNotSell, bestScores, affiliate, dismissedNotices, progress])

  useEffect(() => {
    if (!remote) return
    let ignore = false
    remote.load().then((saved) => {
      if (ignore) return
      setMyList(saved.myList)
      setFavorites(saved.favorites)
      setReminders(saved.reminders)
      setReminderDates(saved.reminderDates)
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
    // Adds a viewing to the history, unless the member paused it (episode 0 for movies)
    const recordViewing = (titleId, episode) => {
      if (!keepHistory) return
      const at = new Date()
      const day = localDay(at)
      const ep = catalog.find((t) => t.id === titleId)?.type === 'show' ? episode : 0
      const entry = { id: `${titleId}:${ep}:${day}`, titleId, episode: ep, day, at }
      if (!remote) {
        setHistory((all) => [entry, ...all.filter((e) => e.id !== entry.id)])
        return
      }
      if (recorded.current.has(entry.id)) return
      recorded.current.add(entry.id)
      save(remote.recordViewing(entry))
    }
    // Resolves to an error message or null
    const changeHistory = async (memoryChange, remoteChange) => {
      if (!remote) {
        setHistory(memoryChange)
        return null
      }
      try {
        await remoteChange()
        return null
      } catch (error) {
        warn(error)
        return 'Your viewing history couldn’t be changed. Please try again.'
      }
    }

    const toggleSaved = (ids, setter, table) => (id) => {
      toggleIn(setter)(id)
      if (remote) save(ids.includes(id) ? remote[table].remove(id) : remote[table].add(id))
    }

    return {
      myList,
      favorites,
      reminders,
      reminderDates,
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
      // releaseDate ('YYYY-MM-DD', optional): when the title comes out, so the bell can say when it's here
      toggleReminder: (id, releaseDate = null) => {
        const on = reminders.includes(id)
        toggleIn(setReminders)(id)
        setReminderDates((dates) => {
          const next = { ...dates }
          delete next[id]
          return on || !releaseDate ? next : { ...next, [id]: releaseDate }
        })
        if (remote) save(on ? remote.reminders.remove(id) : remote.reminders.add(id, releaseDate ? { release_date: releaseDate } : {}))
      },
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
        const number = `NF-${48210 + issues.length}`
        const filed = remote ? await remote.addIssue(issue) : { ...issue, id: number, ticketId: number, at: new Date(), replies: [] }
        setIssues((all) => [filed, ...all])
        return filed
      },
      // A reply on one of the user's tickets; resolves to an error message or null. `asStaff` (in memory only, where the
      // demo account is also the support team) answers from the support dashboard instead.
      async replyToIssue(ticketId, body, { asStaff = false, author = '' } = {}) {
        let reply
        try {
          reply = remote ? await remote.replyToIssue(ticketId, body)
            : { id: `${ticketId}-${Date.now()}`, body, fromStaff: asStaff, author: asStaff ? 'Support team' : author, at: new Date() }
        } catch (error) {
          warn(error)
          return 'Your reply couldn’t be sent. Please try again.'
        }
        setIssues((all) => all.map((t) => (t.ticketId === ticketId ? { ...t, replies: [...(t.replies ?? []), reply] } : t)))
        return null
      },
      // In memory, the support dashboard changes the status here; with Supabase, staff_set_ticket_status() does
      setIssueStatus: (ticketId, status) => setIssues((all) => all.map((t) => (t.ticketId === ticketId ? { ...t, status } : t))),
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
      // Viewing activity: the profile's history, newest first (resolves to the entries; throws if it can't be read)
      loadHistory: async () => (remote ? remote.loadHistory() : history),
      hideFromHistory: (id) => changeHistory((all) => all.filter((e) => e.id !== id), () => remote.hideFromHistory(id)),
      clearHistory: () => {
        recorded.current.clear()
        return changeHistory([], () => remote.clearHistory())
      },
      saveProgress: (titleId, entry) => {
        // Moving on to the next episode (at 0) isn't watching it yet
        if (entry.seconds !== 0) recordViewing(titleId, entry.episode)
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
  }, [remote, keepHistory, history, myList, favorites, reminders, reminderDates, ratings, reviews, feedback, issues, doNotSell, bestScores, affiliate, dismissedNotices, progress])

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
}
