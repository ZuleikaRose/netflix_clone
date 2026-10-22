import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { localDay } from '../data/notifications.js'
import { EXTRA_MINUTES, SAVE_EVERY_SECONDS, emptyUsage, secondsLeft } from '../data/screenTime.js'
import { useAuth } from './authContext.js'
import { useProfile } from './profileContext.js'

// In memory, usage is kept per session, profile and day for the rest of the page load
const memoryUsage = new Map()

const warn = (error) => {
  if (import.meta.env.DEV) console.warn('Supabase:', error)
}

// The watching profile's screen time today (data/screenTime.js). Only a profile with a daily limit counts its time:
// the player calls addSeconds() while it plays; with Supabase they're saved every SAVE_EVERY_SECONDS through
// add_screen_time(), whose answer replaces the local count. allowMoreTime(password) adds EXTRA_MINUTES for today.
export function useScreenTime() {
  const { libraryFor, session, checkPassword } = useAuth()
  const { profile } = useProfile()
  const limit = profile?.dailyLimit ?? null
  const remote = useMemo(() => (profile && limit ? libraryFor?.(profile.id) ?? null : null), [libraryFor, profile, limit])
  const memoryKey = `${session}:${profile?.id}`
  const [usage, setUsage] = useState(() => {
    const kept = memoryUsage.get(memoryKey)
    return kept?.day === localDay(new Date()) ? kept : emptyUsage(localDay(new Date()))
  })
  const pending = useRef(0)
  const [loaded, setLoaded] = useState(!remote)

  useEffect(() => {
    if (!remote) return undefined
    let ignore = false
    remote.loadScreenTime(localDay(new Date())).then((found) => {
      if (ignore) return
      setUsage(found)
      setLoaded(true)
    }, (error) => {
      warn(error)
      if (!ignore) setLoaded(true)
    })
    return () => { ignore = true }
  }, [remote])

  useEffect(() => {
    if (!remote) memoryUsage.set(memoryKey, usage)
  }, [remote, memoryKey, usage])

  const flush = useCallback(() => {
    const seconds = Math.min(60, pending.current)
    if (!remote || seconds < 1) return
    pending.current -= seconds
    remote.addScreenTime(localDay(new Date()), seconds).then(setUsage, warn)
  }, [remote])

  // Saves what's left to save when the player closes or the profile changes
  useEffect(() => flush, [flush])

  const addSeconds = useCallback((seconds) => {
    if (!limit) return
    const day = localDay(new Date())
    // A new day starts from nothing
    setUsage((u) => (u.day === day ? { ...u, seconds: u.seconds + seconds } : { ...emptyUsage(day), seconds }))
    pending.current += seconds
    if (pending.current >= SAVE_EVERY_SECONDS) flush()
  }, [limit, flush])

  // Resolves to an error message or null
  const allowMoreTime = useCallback(async (password) => {
    const day = localDay(new Date())
    if (!remote) {
      const problem = await checkPassword(password)
      if (problem) return problem
      setUsage((u) => (u.day === day ? { ...u, extraSeconds: u.extraSeconds + EXTRA_MINUTES * 60 } : { ...emptyUsage(day), extraSeconds: EXTRA_MINUTES * 60 }))
      return null
    }
    try {
      flush()
      setUsage(await remote.addExtraScreenTime(day, EXTRA_MINUTES, password))
      return null
    } catch (error) {
      warn(error)
      return error?.code === 'P0001' ? error.message : 'More time couldn’t be added. Please try again.'
    }
  }, [remote, checkPassword, flush])

  const today = usage.day === localDay(new Date()) ? usage : emptyUsage(localDay(new Date()))
  const left = secondsLeft(limit, today)
  return {
    limit, // minutes a day, or null
    usedSeconds: today.seconds,
    secondsLeft: left, // null without a limit
    timeUp: loaded && left === 0,
    addSeconds,
    allowMoreTime,
  }
}
