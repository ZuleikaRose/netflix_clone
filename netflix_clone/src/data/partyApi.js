import { authBackend, getSupabase } from '../lib/supabaseConfig.js'

// Watch parties. With Supabase the party is a database row (members only) and joining goes through
// join_watch_party(); in memory there's no server, so the invite link carries the title (?t=).
export const PARTY_NOT_FOUND = 'This watch party has ended or doesn’t exist.'
const inMemory = () => authBackend !== 'supabase'
const newCode = () => [...crypto.getRandomValues(new Uint8Array(5))].map((b) => b.toString(16).padStart(2, '0')).join('')

export const invitePath = (party) => `/party/${party.code}${inMemory() ? `?t=${encodeURIComponent(party.titleId)}` : ''}`

// Resolves to { code, titleId }; throws when the party couldn't be made
export async function startParty(titleId) {
  if (inMemory()) return { code: newCode(), titleId }
  const supabase = await getSupabase()
  const { data, error } = await supabase.from('watch_parties').insert({ title_id: titleId }).select('code, title_id').single()
  if (error) throw error
  return { code: data.code, titleId: data.title_id }
}

// Resolves to { code, titleId, host }; throws an Error with PARTY_NOT_FOUND for a missing or ended party
export async function joinParty(code, titleFromLink) {
  if (inMemory()) {
    if (!titleFromLink) throw new Error(PARTY_NOT_FOUND)
    return { code, titleId: titleFromLink, host: null }
  }
  const supabase = await getSupabase()
  const { data, error } = await supabase.rpc('join_watch_party', { p_code: code })
  if (error) throw new Error(error.code === 'P0002' ? PARTY_NOT_FOUND : 'The watch party couldn’t be joined. Please try again.')
  return { code: data.code, titleId: data.titleId, host: data.host }
}
