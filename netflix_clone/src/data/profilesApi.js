// The signed-in member's profiles in Supabase (RLS: only their own). Shapes match data/profiles.js.

const unwrap = ({ data, error }) => {
  if (error) throw error
  return data
}

const columns = 'id, name, avatar, maturity_rating, notifications_seen_at, locked'
export const toProfile = (row) => ({
  id: row.id, name: row.name, avatar: row.avatar, maturity: row.maturity_rating, notificationsSeenAt: row.notifications_seen_at,
  locked: row.locked,
})
const toRow = (p) => Object.fromEntries(Object.entries({
  name: p.name?.trim(), avatar: p.avatar, maturity_rating: p.maturity, notifications_seen_at: p.notificationsSeenAt,
})
  .filter(([, value]) => value !== undefined))

export const loadProfiles = (supabase, userId) => supabase.from('profiles').select(columns).eq('user_id', userId)
  .order('created_at').order('id').then(unwrap).then((rows) => rows.map(toProfile))

export const insertProfile = (supabase, userId, profile) => supabase.from('profiles')
  .insert({ user_id: userId, ...toRow(profile) }).select(columns).single().then(unwrap).then(toProfile)

export const updateProfileRow = (supabase, userId, id, patch) => supabase.from('profiles')
  .update(toRow(patch)).eq('user_id', userId).eq('id', id).then(unwrap)

export const deleteProfileRow = (supabase, userId, id) => supabase.from('profiles')
  .delete().eq('user_id', userId).eq('id', id).then(unwrap)

// Profile locks (migration ..._profile_locks): the PIN is checked and stored by the database, never read back
export const setProfilePinRow = (supabase, id, pin, password) => supabase
  .rpc('set_profile_pin', { p_profile: id, p_pin: pin, p_password: password }).then(unwrap)
// 'ok' | 'wrong' | 'locked'
export const unlockProfileRow = (supabase, id, pin) => supabase.rpc('unlock_profile', { p_profile: id, p_pin: pin }).then(unwrap)
export const verifyPassword = (supabase, password) => supabase.rpc('verify_account_password', { p_password: password }).then(unwrap)

// A friendlier message for the database's checks (unique names, at most five, at least one)
export function profileErrorMessage(error) {
  if (error?.code === '23505') return 'Another profile already has this name.'
  if (error?.code === 'P0001') return error.message
  return 'Your profile couldn’t be saved. Please try again.'
}
