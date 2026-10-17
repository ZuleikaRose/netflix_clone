// POST /functions/v1/record-referral { code } → { ok: true }
// Counts a click on an affiliate link (/signup?ref=CODE). Visitors aren't signed in, so this is public; sign-ups are
// counted by the sign-up trigger from the referral_code the app passes to Supabase Auth.
import { admin, json, serve } from '../_shared/supabase.ts'

serve(async (_req, body) => {
  const code = typeof body.code === 'string' ? body.code.trim().toUpperCase().slice(0, 24) : ''
  if (!code) return json({ error: 'Missing referral code.' }, 400)

  const { data: affiliate, error } = await admin.from('affiliates').select('id').eq('referral_code', code).maybeSingle()
  if (error) throw error
  // Same answer for unknown codes, so the endpoint can't be used to discover valid ones
  if (!affiliate) return json({ ok: true })

  const { error: insertError } = await admin.from('referrals').insert({ affiliate_id: affiliate.id, kind: 'click' })
  if (insertError) throw insertError
  return json({ ok: true })
})
