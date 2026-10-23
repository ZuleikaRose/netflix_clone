// POST /functions/v1/delete-account { password } (signed in) → { ok: true }
// Removes the caller's access: needs a cancelled membership and the current password. The account and its data stay
// until a data removal ticket is handled, so this bans the user instead of deleting them. A running monthly donation
// is stopped first (needs STRIPE_SECRET_KEY), so a closed account is never charged again.
import Stripe from 'npm:stripe@23.0.0'
import { admin, callerFrom, json, publicClient, serve } from '../_shared/supabase.ts'

const apiKey = Deno.env.get('STRIPE_SECRET_KEY')
const stripe = apiKey ? new Stripe(apiKey, { httpClient: Stripe.createFetchHttpClient(), maxNetworkRetries: 2 }) : null

async function stopMonthlyDonations(userId: string) {
  const { data, error } = await admin.from('monthly_donations').select('id, stripe_subscription_id')
    .eq('user_id', userId).neq('status', 'canceled')
  if (error) throw error
  for (const row of data ?? []) {
    if (!stripe) throw new Error('STRIPE_SECRET_KEY is not set')
    try {
      await stripe.subscriptions.cancel(row.stripe_subscription_id)
    } catch (cancelError) {
      // Already cancelled in Stripe: only our row is out of date
      if ((cancelError as { code?: string }).code !== 'resource_missing') throw cancelError
    }
    const { error: updateError } = await admin.from('monthly_donations')
      .update({ status: 'canceled', canceled_at: new Date().toISOString() }).eq('id', row.id)
    if (updateError) throw updateError
  }
}

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

  try {
    await stopMonthlyDonations(user.id)
  } catch (stopError) {
    console.error('delete-account: stopping the monthly donation failed', stopError)
    return json({ error: 'Your monthly donation couldn’t be stopped, so your account is still open. Please try again.' }, 502)
  }

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
