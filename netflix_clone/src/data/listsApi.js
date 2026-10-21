import { authBackend, getSupabase } from '../lib/supabaseConfig.js'

// Public lists shared on this page load (in-memory accounts only): slug → { name, description, owner, updatedAt, titleIds }
export const memorySharedLists = new Map()

// A public list by its share link: { name, description, owner, updatedAt, titleIds }, or null when there's no such
// public list. Throws when the database can't be reached.
export async function fetchSharedList(slug) {
  // Lists live with the accounts: in memory, even when the catalog comes from Supabase
  if (authBackend !== 'supabase') return memorySharedLists.get(slug) ?? null
  const supabase = await getSupabase()
  const { data, error } = await supabase.rpc('shared_list', { p_slug: slug })
  if (error) throw error
  return data ? { ...data, updatedAt: new Date(data.updatedAt) } : null
}
