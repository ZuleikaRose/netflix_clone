// POST /functions/v1/demo-account → { email, password, expiresAt }
// Creates a private demo account for one visitor: random email and password, a little sample data, deleted after
// 24 hours by the delete-expired-demo-accounts cron job. The browser then signs in with the returned password.
import { admin, json, serve } from '../_shared/supabase.ts'

// Plenty for a demo; stops a script from creating accounts without limit
const MAX_PER_HOUR = 300
const LIFETIME_HOURS = 24
// No 0/o/1/l/i: the password is shown on screen and typed back in to change it or delete the account
const READABLE = 'abcdefghjkmnpqrstuvwxyz23456789'
const randomString = (length: number) =>
  Array.from(crypto.getRandomValues(new Uint8Array(length)), (b) => READABLE[b % READABLE.length]).join('')

serve(async () => {
  const hourAgo = new Date(Date.now() - 3600_000).toISOString()
  const { count, error: countError } = await admin.from('netflix_tables').select('id', { count: 'exact', head: true })
    .like('email', 'demo-%@example.com').gte('created_at', hourAgo)
  if (countError) throw countError
  if ((count ?? 0) >= MAX_PER_HOUR) return json({ error: 'The demo is busy right now. Please try again in a few minutes.' }, 429)

  const email = `demo-${randomString(10)}@example.com`
  const password = randomString(12)
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: 'Alex', plan: 'standard' },
    app_metadata: { demo: true },
  })
  if (error) throw error

  // The sign-up trigger has created the account and preferences; add something to look at
  const userId = data.user.id
  const { error: sampleError } = await admin.from('watch_list_tables').insert([
    { user_id: userId, title_id: 'behind-the-glass' },
    { user_id: userId, title_id: 'lantern-island' },
  ])
  if (sampleError) throw sampleError

  const expiresAt = new Date(Date.parse(data.user.created_at) + LIFETIME_HOURS * 3600_000).toISOString()
  return json({ email, password, expiresAt })
})
