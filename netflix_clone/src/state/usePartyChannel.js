import { useEffect, useRef, useState } from 'react'
import { authBackend, getSupabase } from '../lib/supabaseConfig.js'

// The events members send each other: sync (play, pause, seek, episode), hello (just joined: please send the state),
// state (the answer) and chat
const EVENTS = ['sync', 'hello', 'state', 'chat']

// A watch party's channel: { status: 'connecting' | 'live' | 'failed', people: [{ id, name }], send(event, payload) }.
// me: { id (one per browser tab), name }. onMessage(event, payload, send) receives the other members' events.
// With Supabase it's the private Realtime channel party:<code> (broadcast + presence, members only); in memory, a
// BroadcastChannel between this browser's tabs, which also stands in for presence.
export function usePartyChannel(code, me, onMessage) {
  const [status, setStatus] = useState('connecting')
  const [people, setPeople] = useState([])
  const sender = useRef(() => {})
  const handler = useRef(onMessage)
  useEffect(() => {
    handler.current = onMessage
  })

  useEffect(() => {
    if (!code) return undefined
    let closed = false
    let cleanup = () => {}

    if (authBackend !== 'supabase') {
      // Older browsers (Safari before 15.4) have no BroadcastChannel
      if (typeof BroadcastChannel === 'undefined') {
        queueMicrotask(() => { if (!closed) setStatus('failed') })
        return () => { closed = true }
      }
      const channel = new BroadcastChannel(`party:${code}`)
      const others = new Map()
      const show = () => setPeople([me, ...others.values()])
      const post = (event, payload) => channel.postMessage({ event, payload, from: me.id })
      channel.onmessage = ({ data }) => {
        const { event, payload, from } = data
        if (event === 'here' || event === 'here-too') {
          others.set(from, payload)
          show()
          if (event === 'here') post('here-too', me)
        } else if (event === 'bye') {
          others.delete(from)
          show()
        } else handler.current(event, payload, (e, p) => sender.current(e, p))
      }
      const leave = () => post('bye', me)
      window.addEventListener('pagehide', leave)
      sender.current = post
      post('here', me)
      queueMicrotask(() => {
        if (closed) return
        show()
        setStatus('live')
      })
      cleanup = () => {
        leave()
        window.removeEventListener('pagehide', leave)
        channel.close()
      }
    } else {
      getSupabase().then(async (supabase) => {
        if (closed) return
        // Private channels check the member's own token against the RLS policies on realtime.messages
        await supabase.realtime.setAuth()
        const channel = supabase.channel(`party:${code}`, {
          config: { private: true, broadcast: { self: false }, presence: { key: me.id } },
        })
        for (const event of EVENTS) {
          channel.on('broadcast', { event }, ({ payload }) => handler.current(event, payload.body, (e, p) => sender.current(e, p)))
        }
        channel.on('presence', { event: 'sync' }, () => {
          setPeople(Object.values(channel.presenceState()).map((entries) => entries[0]).map(({ id, name }) => ({ id, name })))
        })
        channel.subscribe(async (state) => {
          if (state === 'SUBSCRIBED') {
            // Not being listed under "Watching now" is no reason to stop the party
            await channel.track(me).catch(() => {})
            setStatus('live')
          } else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') setStatus('failed')
        })
        // A message that can't be sent shows as a lost connection
        sender.current = (event, body) => channel.send({ type: 'broadcast', event, payload: { body, from: me.id } })
          .then((result) => { if (result !== 'ok') setStatus('failed') })
          .catch(() => setStatus('failed'))
        cleanup = () => supabase.removeChannel(channel)
        if (closed) cleanup()
      }).catch(() => setStatus('failed'))
    }
    return () => {
      closed = true
      sender.current = () => {}
      cleanup()
    }
  }, [code, me])

  return { status, people, send: (event, payload) => sender.current(event, payload) }
}
