// POST /functions/v1/delete-account { password } (signed in) → { ok: true }
// Removes the caller's access: needs a cancelled membership and the current password. The account and its data stay
// until a data removal ticket is handled, so this bans the user instead of deleting them.
import { admin, callerFrom, json, publicClient, serve } from '../_shared/supabase.ts'

serve(async (req, body) => {
  const caller = await callerFrom(req)
  if (!caller) return json({ error: 'Please sign in again.' }, 401)
  const { user, token } = caller
  const password = typeof body.password === 'string' ? body.password : ''
  if (!password) return json({ error: 'Please enter your password.' }, 400)

  const { data: account, error } = await admin.from('netflix_tables').select('membership_status').eq('id', user.id).single()
  if (error) throw error
  if (account.membership_status !== 'cancelled') {
    return json({ error: 'Cancel your membership before deleting your account.' }, 409)
  }

  // Check the password on a throwaway client so the caller's own session isn't affected
  const checker = publicClient()
  const { error: passwordError } = await checker.auth.signInWithPassword({ email: user.email!, password })
  if (passwordError) return json({ error: 'Your password is incorrect.' }, 403)
  await checker.auth.signOut()

  const { error: updateError } = await admin.from('netflix_tables')
    .update({ access_removed_at: new Date().toISOString() }).eq('id', user.id)
  if (updateError) throw updateError
  // Revoke every session first: banning removes them too, after which signOut finds nothing to revoke. Not fatal,
  // because the ban below also stops refreshes; logged so it shows in the function logs.
  const { error: signOutError } = await admin.auth.admin.signOut(token, 'global')
  if (signOutError) console.error('delete-account: revoking sessions failed', signOutError)
  // ~100 years: blocks new sign-ins. The current access token stays valid until it expires (1 hour), so the app
  // signs out locally too.
  const { error: banError } = await admin.auth.admin.updateUserById(user.id, { ban_duration: '876000h' })
  if (banError) throw banError

  return json({ ok: true })
})
