// POST /functions/v1/demo-account → { email, password, expiresAt }
// Creates a private demo account for one visitor: random email and password, a little sample data, deleted after
// 24 hours by the delete-expired-demo-accounts cron job. The browser then signs in with the returned password.
import { admin, allowRequest, clientIp, json, serve } from '../_shared/supabase.ts'

// Plenty for a demo (and for running the e2e suite a few times an hour); stops a script from creating accounts
// without limit: per visitor IP, and overall
const MAX_PER_IP_PER_HOUR = 20
const MAX_PER_HOUR = 300
const LIFETIME_HOURS = 24
// No 0/O/o/1/l/I/i: the password is shown on screen and typed back in to change it or delete the account
const LOWER = 'abcdefghjkmnpqrstuvwxyz'
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const DIGITS = '23456789'
const SYMBOLS = '!@#$%*?-_'
const randomIndex = (n: number) => crypto.getRandomValues(new Uint32Array(1))[0] % n
const pick = (chars: string) => chars[randomIndex(chars.length)]
const randomString = (length: number, chars = LOWER + DIGITS) => Array.from({ length }, () => pick(chars)).join('')

// 16 characters with at least one of each kind, so it passes the strictest Auth password rules (13+ characters,
// lower, upper, digit and symbol required)
function randomPassword() {
  const chars = [pick(LOWER), pick(UPPER), pick(DIGITS), pick(SYMBOLS), ...randomString(12, LOWER + UPPER + DIGITS + SYMBOLS)]
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

serve(async (req) => {
  if (!(await allowRequest(`demo-account:${clientIp(req)}`, MAX_PER_IP_PER_HOUR, 3600))) {
    return json({ error: 'You’ve created several demo accounts recently. Please try again in an hour, or sign up.' }, 429)
  }
  const hourAgo = new Date(Date.now() - 3600_000).toISOString()
  const { count, error: countError } = await admin.from('netflix_tables').select('id', { count: 'exact', head: true })
    .like('email', 'demo-%@example.com').gte('created_at', hourAgo)
  if (countError) throw countError
  if ((count ?? 0) >= MAX_PER_HOUR) return json({ error: 'The demo is busy right now. Please try again in a few minutes.' }, 429)

  const email = `demo-${randomString(10)}@example.com`
  const password = randomPassword()
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
