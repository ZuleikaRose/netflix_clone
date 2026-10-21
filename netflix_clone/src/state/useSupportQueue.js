import { useEffect, useState } from 'react'
import { fetchReplies, fetchStaffTickets, postStaffReply, setTicketStatus } from '../data/supportApi.js'
import { getSupabase } from '../lib/supabaseConfig.js'
import { useAuth } from './authContext.js'
import { useLibrary } from './libraryContext.js'

const warn = (error) => {
  if (import.meta.env.DEV) console.warn('Supabase:', error)
}

// The support dashboard's tickets (status null = all) and actions. With Supabase: every member's tickets through the
// staff-only database functions. In memory there are no other members, so the demo account's own reports stand in.
export function useSupportQueue(status) {
  const { backend, user } = useAuth()
  const library = useLibrary()
  const [loaded, setLoaded] = useState({ key: null, tickets: null, failed: false })
  const [version, setVersion] = useState(0)
  const key = `${status}:${version}`

  useEffect(() => {
    if (backend !== 'supabase') return undefined
    let ignore = false
    getSupabase()
      .then((supabase) => fetchStaffTickets(supabase, status))
      .then((tickets) => { if (!ignore) setLoaded({ key, tickets, failed: false }) })
      .catch((error) => {
        warn(error)
        if (!ignore) setLoaded({ key, tickets: null, failed: true })
      })
    return () => { ignore = true }
  }, [backend, status, key])

  if (backend !== 'supabase') {
    const tickets = library.issues
      .filter((t) => !status || t.status === status)
      .map((t) => ({ ...t, member: user.name, email: user.email, replyCount: t.replies?.length ?? 0 }))
    return {
      tickets,
      failed: false,
      loadReplies: async (ticket) => library.issues.find((t) => t.ticketId === ticket.ticketId)?.replies ?? [],
      async changeStatus(ticket, next) {
        library.setIssueStatus(ticket.ticketId, next)
        return null
      },
      async reply(ticket, body) {
        const error = await library.replyToIssue(ticket.ticketId, body, { asStaff: true })
        return error ? { error } : { reply: null }
      },
    }
  }

  const current = loaded.key === key ? loaded : null
  return {
    tickets: current?.tickets ?? null,
    failed: Boolean(current?.failed),
    loadReplies: async (ticket) => fetchReplies(await getSupabase(), ticket.ticketId),
    // Each resolves to an error message or null (reply: { error } or { reply })
    async changeStatus(ticket, next) {
      try {
        await setTicketStatus(await getSupabase(), ticket.ticketId, next)
      } catch (error) {
        warn(error)
        return 'The status couldn’t be changed. Please try again.'
      }
      setVersion((v) => v + 1)
      return null
    },
    async reply(ticket, body) {
      try {
        const reply = await postStaffReply(await getSupabase(), user.id, ticket.ticketId, body)
        setVersion((v) => v + 1)
        return { reply }
      } catch (error) {
        warn(error)
        return { error: 'Your reply couldn’t be sent. Please try again.' }
      }
    },
  }
}
